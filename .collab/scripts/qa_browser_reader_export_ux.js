#!/usr/bin/env node
/* Browser UX checks for authenticated reader citation and export flows. */

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

async function waitForReader(page) {
  await page.getByText(/semiconductor reading list/i).first().waitFor({ timeout: 30000 });
  await page.locator("canvas:visible").first().waitFor({ timeout: 30000 });
}

async function waitForVisibleText(page, pattern) {
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
  }, pattern.source, { timeout: 30000 });
}

async function layoutMetrics(page) {
  return await page.evaluate(() => {
    const panes = [...document.querySelectorAll(".dt-reader-pane")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const composer = document.querySelector(".dt-composer");
    const composerRect = composer ? composer.getBoundingClientRect() : null;
    const overflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
    const bodyOverflowY = document.documentElement.scrollHeight > window.innerHeight + 2;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      panes,
      composer: composerRect ? { x: composerRect.x, y: composerRect.y, w: composerRect.width, h: composerRect.height } : null,
      overflowX,
      bodyOverflowY,
    };
  });
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

  await page.goto(`${baseUrl}/d/${fixture.document_id}`, { waitUntil: "domcontentloaded" });
  await waitForReader(page);

  const authSession = await page.request.get(`${baseUrl}/api/auth/session`);
  const profile = await page.request.get(`${baseUrl}/api/proxy/api/users/profile`);
  const metricsBefore = await layoutMetrics(page);

  const more = page.getByLabel(/more options/i).first();
  await more.waitFor({ timeout: 10000 });
  await more.click();
  await page.getByRole("menuitem", { name: /Export Markdown/i }).waitFor({ timeout: 10000 });
  await page.getByRole("menuitem", { name: /Export PDF/i }).waitFor({ timeout: 10000 });
  await page.getByRole("menuitem", { name: /Export DOCX/i }).waitFor({ timeout: 10000 });

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("menuitem", { name: /Export PDF/i }).click(),
  ]);
  const pdfPath = await pdfDownload.path();
  const pdfBytes = fs.statSync(pdfPath).size;
  const pdfHeader = fs.readFileSync(pdfPath).subarray(0, 4).toString("latin1");

  await more.click();
  const [docxDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("menuitem", { name: /Export DOCX/i }).click(),
  ]);
  const docxPath = await docxDownload.path();
  const docxBytes = fs.statSync(docxPath).size;
  const docxHeader = fs.readFileSync(docxPath).subarray(0, 2).toString("latin1");

  await page.locator(".dt-source-index:visible").first().click();
  await page.locator(".citation-overlay:visible").first().waitFor({ timeout: 20000 });
  const overlayCount = await page.locator(".citation-overlay:visible").count();
  const metricsAfterCitation = await layoutMetrics(page);
  const screenshot = path.join(screenshotDir, "reader-desktop-citation-export.png");
  await page.screenshot({ path: screenshot, fullPage: false });

  report.desktop = {
    url: page.url(),
    title: await page.title(),
    auth_session_status: authSession.status(),
    profile_status: profile.status(),
    metrics_before: metricsBefore,
    metrics_after_citation: metricsAfterCitation,
    pdf_download: {
      suggested_filename: pdfDownload.suggestedFilename(),
      bytes: pdfBytes,
      header: pdfHeader,
    },
    docx_download: {
      suggested_filename: docxDownload.suggestedFilename(),
      bytes: docxBytes,
      header: docxHeader,
    },
    citation_overlay_count: overlayCount,
    screenshot,
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

  await page.goto(`${baseUrl}/d/${fixture.document_id}`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /semiconductor reading list/);
  await page.locator(".dt-source-index:visible").first().click();
  await page.locator("canvas:visible").first().waitFor({ timeout: 30000 });
  await page.locator(".citation-overlay:visible").first().waitFor({ timeout: 20000 });
  const overlayCount = await page.locator(".citation-overlay:visible").count();
  const documentTabSelected = await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const button = [...document.querySelectorAll("button")]
      .find((el) => visible(el) && /document/i.test(el.textContent || ""));
    return button ? /text-blue/.test(button.getAttribute("class") || "") : null;
  });
  const metrics = await layoutMetrics(page);
  const screenshot = path.join(screenshotDir, "reader-mobile-citation.png");
  await page.screenshot({ path: screenshot, fullPage: false });

  report.mobile = {
    url: page.url(),
    title: await page.title(),
    document_tab_selected_after_citation: documentTabSelected,
    inner_width: await page.evaluate(() => window.innerWidth),
    citation_overlay_count: overlayCount,
    metrics,
    screenshot,
    console_errors: consoleErrors,
  };

  await context.close();
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-reader-fixture-2026-05-10.json"));
  const baseUrl = arg("base-url", "http://127.0.0.1:3001");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-reader-export-ux-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    document_id: fixture.document_id,
    session_id: fixture.session_id,
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
    report.desktop.pdf_download.header === "%PDF" &&
    report.desktop.pdf_download.bytes > 1000 &&
    report.desktop.docx_download.header === "PK" &&
    report.desktop.docx_download.bytes > 1000 &&
    report.desktop.citation_overlay_count > 0 &&
    !report.desktop.metrics_after_citation.overflowX;
  const mobileOk =
    report.mobile.document_tab_selected_after_citation &&
    report.mobile.citation_overlay_count > 0 &&
    !report.mobile.metrics.overflowX;
  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: browser reader/export UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser reader/export UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
