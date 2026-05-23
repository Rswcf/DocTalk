#!/usr/bin/env node
/* Browser UX check for Free-plan document-limit upload and URL import errors. */

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

async function visibleSnapshot(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const links = [...document.querySelectorAll("a")]
      .filter(visible)
      .map((el) => ({ text: (el.textContent || "").trim(), href: el.getAttribute("href") || "" }));
    const buttons = [...document.querySelectorAll("button")]
      .filter(visible)
      .map((el) => (el.textContent || "").trim());
    return {
      url: window.location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      body: document.body.innerText,
      links,
      buttons,
      readyDocNames: [...document.querySelectorAll("body *")]
        .filter(visible)
        .map((el) => el.textContent || "")
        .filter((text) => /qa-free-limit-existing/i.test(text)),
    };
  });
}

async function waitForDashboard(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('input[aria-label="Upload document"]').waitFor({ state: "attached", timeout: 30000 });
  await page.locator('input[aria-label="Document URL"]').waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Choose File|选择文件|Choisir|Datei|Elegir|Scegli|ファイル|파일|Escolher|اختر|चुनें/i }).waitFor({ timeout: 30000 });
}

async function waitForLimitCopy(page) {
  await page.waitForFunction(() => /document limit|reached your plan|upgrade for more/i.test(document.body.innerText), null, { timeout: 30000 });
}

async function runViewport(browser, fixture, baseUrl, screenshotDir, name, viewportOptions) {
  const context = await browser.newContext({ ...viewportOptions });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  const ignoredConsoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource: the server responded with a status of 403/i.test(text)) {
      ignoredConsoleErrors.push(text);
      return;
    }
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await waitForDashboard(page, baseUrl);
  const initial = await visibleSnapshot(page);
  const profile = await page.request.get(`${baseUrl}/api/proxy/api/users/profile`);
  const docs = await page.request.get(`${baseUrl}/api/proxy/api/documents`);
  const profileBody = await profile.json().catch(async () => ({ text: await profile.text() }));
  const docsBody = await docs.json().catch(async () => ({ text: await docs.text() }));

  const pdfPath = path.join(ROOT, "test_inputs", "semiconductor.pdf");
  await page.locator('input[aria-label="Upload document"]').setInputFiles(pdfPath);
  await waitForLimitCopy(page);
  const afterUpload = await visibleSnapshot(page);
  const uploadScreenshot = path.join(screenshotDir, `plan-limit-${name}-upload.png`);
  await page.screenshot({ path: uploadScreenshot, fullPage: false });

  await page.locator('input[aria-label="Document URL"]').fill("https://example.com/");
  await page.getByRole("button", { name: /Import URL|导入链接|Importer|Importar|URL importieren|URLをインポート|URL 가져오기|Importa URL|استيراد رابط|URL आयात/i }).click();
  await waitForLimitCopy(page);
  const afterUrl = await visibleSnapshot(page);
  const urlScreenshot = path.join(screenshotDir, `plan-limit-${name}-url.png`);
  await page.screenshot({ path: urlScreenshot, fullPage: false });

  await context.close();
  return {
    profile_status: profile.status(),
    profile_plan: profileBody.plan,
    docs_status: docs.status(),
    docs_count: Array.isArray(docsBody) ? docsBody.length : null,
    initial,
    after_upload: afterUpload,
    after_url: afterUrl,
    screenshots: { upload: uploadScreenshot, url: urlScreenshot },
    console_errors: consoleErrors,
    ignored_console_errors: ignoredConsoleErrors,
  };
}

function limitOk(result, expectedCount) {
  const uploadText = result.after_upload.body;
  const urlText = result.after_url.body;
  const uploadUpgrade = result.after_upload.links.some((link) => /upgrade/i.test(link.text) && /billing/.test(link.href));
  const urlUpgrade = result.after_url.links.some((link) => /upgrade/i.test(link.text) && /billing/.test(link.href));
  return result.profile_status === 200
    && result.profile_plan === "free"
    && result.docs_status === 200
    && result.docs_count === expectedCount
    && /document limit|reached your plan/i.test(uploadText)
    && /document limit|reached your plan/i.test(urlText)
    && uploadUpgrade
    && urlUpgrade
    && !result.after_upload.overflowX
    && !result.after_url.overflowX
    && !/\/d\/[0-9a-f-]{36}/i.test(result.after_upload.url)
    && !/\/d\/[0-9a-f-]{36}/i.test(result.after_url.url)
    && result.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-plan-limit-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://127.0.0.1:3000").replace(/\/$/, "");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-plan-limit-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    user_id: fixture.user.id,
    expected_document_count: fixture.max_documents,
  };
  try {
    report.desktop = await runViewport(browser, fixture, baseUrl, screenshotDir, "desktop", { viewport: { width: 1440, height: 900 } });
    report.mobile = await runViewport(browser, fixture, baseUrl, screenshotDir, "mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  } finally {
    await browser.close();
  }

  report.summary = {
    desktop_ok: limitOk(report.desktop, fixture.max_documents),
    mobile_ok: limitOk(report.mobile, fixture.max_documents),
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
    ignored_plan_limit_403_console_errors:
      report.desktop.ignored_console_errors.length + report.mobile.ignored_console_errors.length,
  };
  report.result = report.summary.desktop_ok && report.summary.mobile_ok ? "pass" : "fail";
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== "pass") {
    console.error(`FAIL: browser plan-limit UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser plan-limit UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
