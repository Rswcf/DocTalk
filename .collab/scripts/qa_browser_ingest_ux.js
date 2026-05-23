#!/usr/bin/env node
/* Browser UX checks for authenticated upload and URL ingestion flows. */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "../..");
const frontendRequire = createRequire(path.join(ROOT, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");
const { encode } = frontendRequire("next-auth/jwt");

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

async function makeCookie(user, baseUrl) {
  const env = {
    ...readEnv(path.join(ROOT, "frontend", ".env.local")),
    ...process.env,
  };
  const secret = env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to generate Auth.js session cookie");
  const url = new URL(baseUrl);
  const cookieName = "authjs.session-token";
  const value = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name || user.email,
    },
    secret,
    salt: cookieName,
    maxAge: 60 * 60,
  });
  return {
    name: cookieName,
    value,
    domain: url.hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  };
}

function docIdFromUrl(rawUrl) {
  const match = new URL(rawUrl).pathname.match(/^\/d\/([0-9a-f-]{36})$/i);
  if (!match) throw new Error(`Could not extract document id from ${rawUrl}`);
  return match[1];
}

async function visibleText(page, pattern) {
  return await page.evaluate((source) => {
    const regex = new RegExp(source, "i");
    return [...document.querySelectorAll("body *")].some((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return regex.test(el.textContent || "")
        && style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    });
  }, pattern.source);
}

async function waitForVisibleText(page, pattern, timeout = 30000) {
  await page.waitForFunction((source) => {
    const regex = new RegExp(source, "i");
    return [...document.querySelectorAll("body *")].some((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return regex.test(el.textContent || "")
        && style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    });
  }, pattern.source, { timeout });
}

async function waitForDashboard(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('input[aria-label="Upload document"]').waitFor({ state: "attached", timeout: 30000 });
  await page.getByRole("button", {
    name: /Choose File|选择文件|Choisir|Datei|Elegir|Scegli|ファイル|파일|Escolher|اختر|चुनें/i,
  }).waitFor({ timeout: 30000 });
  await page.locator('input[aria-label="Document URL"]').waitFor({ timeout: 30000 });
}

async function waitForReadyViaProxy(page, baseUrl, docId, timeoutMs = 180000) {
  const started = Date.now();
  const polls = [];
  while (Date.now() - started < timeoutMs) {
    const res = await page.request.get(`${baseUrl}/api/proxy/api/documents/${docId}`);
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = { text: await res.text() };
    }
    polls.push({
      at_ms: Date.now() - started,
      status_code: res.status(),
      status: body.status || null,
      chunks_indexed: body.chunks_indexed ?? null,
      pages_parsed: body.pages_parsed ?? null,
      file_type: body.file_type || null,
    });
    if (body.status === "ready" || body.status === "error") {
      return { body, polls };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Document ${docId} did not reach ready/error within ${timeoutMs}ms`);
}

async function layoutMetrics(page) {
  return await page.evaluate(() => ({
    viewport: { w: window.innerWidth, h: window.innerHeight },
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    scrollWidth: document.documentElement.scrollWidth,
    bodyTextLength: document.body.innerText.length,
    uploadInputAttached: Boolean(document.querySelector('input[aria-label="Upload document"]')),
    urlVisible: Boolean(document.querySelector('input[aria-label="Document URL"]')),
  }));
}

async function clickImportUrl(page) {
  const button = page.getByRole("button", {
    name: /Import URL|导入链接|Importer|Importar|URL importieren|URLをインポート|URL 가져오기|Importa URL|استيراد رابط|URL आयात/i,
  });
  await button.click();
}

function visibleErrorAlert(page) {
  return page.locator('div[role="alert"]').filter({ hasText: /URL|Failed|失败|invalid|Ungultig/i }).first();
}

async function runDesktop(browser, fixture, baseUrl, screenshotDir, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await waitForDashboard(page, baseUrl);
  const authSession = await page.request.get(`${baseUrl}/api/auth/session`);
  const profile = await page.request.get(`${baseUrl}/api/proxy/api/users/profile`);
  const dashboardMetrics = await layoutMetrics(page);

  const unsupportedPath = path.join(ROOT, "test_inputs", "ai-report-2026-02-10-en.html");
  await page.locator('input[aria-label="Upload document"]').setInputFiles(unsupportedPath);
  const unsupportedPattern = /Unsupported file format|Unsupported format|格式不受支持|Formato no compatible|Nicht unterstutztes Format|Format non pris/i;
  await waitForVisibleText(page, unsupportedPattern);
  const unsupportedVisible = await visibleText(page, unsupportedPattern);

  const uploadStarted = Date.now();
  const pdfPath = path.join(ROOT, "test_inputs", "semiconductor.pdf");
  await page.locator('input[aria-label="Upload document"]').setInputFiles(pdfPath);
  await page.waitForURL(/\/d\/[0-9a-f-]{36}$/i, { timeout: 180000 });
  const uploadDocId = docIdFromUrl(page.url());
  await page.locator("canvas:visible").first().waitFor({ timeout: 45000 });
  await page.locator(".dt-composer:visible").first().waitFor({ timeout: 45000 });
  const uploadReady = await waitForReadyViaProxy(page, baseUrl, uploadDocId, 30000);
  const uploadMetrics = await layoutMetrics(page);
  const uploadScreenshot = path.join(screenshotDir, "ingest-desktop-upload-reader.png");
  await page.screenshot({ path: uploadScreenshot, fullPage: false });

  await waitForDashboard(page, baseUrl);
  await page.locator('input[aria-label="Document URL"]').fill("ftp://example.com/nope");
  await clickImportUrl(page);
  await visibleErrorAlert(page).waitFor({ timeout: 10000 });
  const invalidUrlText = await visibleErrorAlert(page).innerText();

  const urlStarted = Date.now();
  await page.locator('input[aria-label="Document URL"]').fill("https://example.com/");
  await clickImportUrl(page);
  await page.waitForURL(/\/d\/[0-9a-f-]{36}$/i, { timeout: 60000 });
  const urlDocId = docIdFromUrl(page.url());
  const urlReady = await waitForReadyViaProxy(page, baseUrl, urlDocId, 120000);
  if (urlReady.body.status !== "ready") {
    throw new Error(`URL document ended with status=${urlReady.body.status}`);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /Example Domain|example\.com/i, 45000);
  await page.locator(".dt-composer:visible").first().waitFor({ timeout: 45000 });
  const urlMetrics = await layoutMetrics(page);
  const urlScreenshot = path.join(screenshotDir, "ingest-desktop-url-reader.png");
  await page.screenshot({ path: urlScreenshot, fullPage: false });

  report.desktop = {
    auth_session_status: authSession.status(),
    profile_status: profile.status(),
    dashboard_metrics: dashboardMetrics,
    unsupported_upload_visible: unsupportedVisible,
    upload: {
      document_id: uploadDocId,
      ready_status: uploadReady.body.status,
      file_type: uploadReady.body.file_type,
      pages_parsed: uploadReady.body.pages_parsed,
      chunks_indexed: uploadReady.body.chunks_indexed,
      elapsed_ms: Date.now() - uploadStarted,
      polls: uploadReady.polls,
      metrics: uploadMetrics,
      screenshot: uploadScreenshot,
    },
    invalid_url_text: invalidUrlText,
    url_import: {
      document_id: urlDocId,
      ready_status: urlReady.body.status,
      file_type: urlReady.body.file_type,
      source_url: urlReady.body.source_url,
      pages_parsed: urlReady.body.pages_parsed,
      chunks_indexed: urlReady.body.chunks_indexed,
      elapsed_ms: Date.now() - urlStarted,
      polls: urlReady.polls,
      metrics: urlMetrics,
      screenshot: urlScreenshot,
    },
    console_errors: consoleErrors,
  };

  await context.close();
}

async function runMobile(browser, fixture, baseUrl, screenshotDir, report) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await waitForDashboard(page, baseUrl);
  const dashboardMetrics = await layoutMetrics(page);
  await page.locator('input[aria-label="Document URL"]').fill("not-a-url");
  await clickImportUrl(page);
  await visibleErrorAlert(page).waitFor({ timeout: 10000 });
  const invalidUrlText = await visibleErrorAlert(page).innerText();

  const started = Date.now();
  const pdfPath = path.join(ROOT, "test_inputs", "semiconductor.pdf");
  await page.locator('input[aria-label="Upload document"]').setInputFiles(pdfPath);
  await page.waitForURL(/\/d\/[0-9a-f-]{36}$/i, { timeout: 180000 });
  const uploadDocId = docIdFromUrl(page.url());
  await page.getByRole("button", { name: /Document|文档|Dokument|Documento|문서|ドキュメント|Document/i }).click();
  await page.locator("canvas:visible").first().waitFor({ timeout: 45000 });
  const ready = await waitForReadyViaProxy(page, baseUrl, uploadDocId, 30000);
  const metrics = await layoutMetrics(page);
  const screenshot = path.join(screenshotDir, "ingest-mobile-upload-reader.png");
  await page.screenshot({ path: screenshot, fullPage: false });

  report.mobile = {
    dashboard_metrics: dashboardMetrics,
    invalid_url_text: invalidUrlText,
    upload: {
      document_id: uploadDocId,
      ready_status: ready.body.status,
      file_type: ready.body.file_type,
      pages_parsed: ready.body.pages_parsed,
      chunks_indexed: ready.body.chunks_indexed,
      elapsed_ms: Date.now() - started,
      metrics,
      screenshot,
    },
    console_errors: consoleErrors,
  };

  await context.close();
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-ingest-fixture-2026-05-10.json"));
  const baseUrl = arg("base-url", "http://127.0.0.1:3001");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-ingest-ux-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    user_id: fixture.user.id,
  };

  const browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP host.docker.internal 127.0.0.1"],
  });
  try {
    await runDesktop(browser, fixture, baseUrl, screenshotDir, report);
    await runMobile(browser, fixture, baseUrl, screenshotDir, report);
  } finally {
    await browser.close();
  }

  const desktopOk =
    report.desktop.auth_session_status === 200 &&
    report.desktop.profile_status === 200 &&
    report.desktop.unsupported_upload_visible &&
    /URL|Failed|失败|Ungultig|invalid/i.test(report.desktop.invalid_url_text) &&
    report.desktop.upload.ready_status === "ready" &&
    report.desktop.upload.file_type === "pdf" &&
    report.desktop.upload.chunks_indexed > 0 &&
    !report.desktop.upload.metrics.overflowX &&
    report.desktop.url_import.ready_status === "ready" &&
    report.desktop.url_import.file_type === "url" &&
    report.desktop.url_import.chunks_indexed > 0 &&
    !report.desktop.url_import.metrics.overflowX &&
    report.desktop.console_errors.length === 0;

  const mobileOk =
    !report.mobile.dashboard_metrics.overflowX &&
    /URL|Failed|失败|Ungultig|invalid/i.test(report.mobile.invalid_url_text) &&
    report.mobile.upload.ready_status === "ready" &&
    report.mobile.upload.file_type === "pdf" &&
    report.mobile.upload.chunks_indexed > 0 &&
    !report.mobile.upload.metrics.overflowX &&
    report.mobile.console_errors.length === 0;

  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: browser ingest UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser ingest UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
