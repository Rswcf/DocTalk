#!/usr/bin/env node
/* Browser UX check for completed Document Diff result rendering and exports. */

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

function attachConsole(page) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  return consoleErrors;
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

async function layoutMetrics(page) {
  return await page.evaluate(() => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const buttons = [...document.querySelectorAll("button")]
      .filter(isVisible)
      .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      bodyText: document.body.innerText,
      bodyTextLength: document.body.innerText.length,
      buttons,
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5")]
        .filter(isVisible)
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean)
        .slice(0, 20),
    };
  });
}

async function readDownload(download) {
  const filePath = await download.path();
  const content = fs.readFileSync(filePath, "utf8");
  return {
    suggested_filename: download.suggestedFilename(),
    bytes: Buffer.byteLength(content),
    preview: content.slice(0, 500),
  };
}

async function runViewport(browser, fixture, baseUrl, screenshotDir, name, viewportOptions) {
  const context = await browser.newContext({ ...viewportOptions, acceptDownloads: true });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);
  const popups = [];
  page.on("popup", (popup) => {
    popups.push(popup.url());
  });

  await page.goto(`${baseUrl}/document-diff`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /Semantic document diff|Compare two versions/i);
  await waitForVisibleText(page, /Completed/i, 180000);
  for (const term of fixture.expected_terms || ["Refund window extended", "Enterprise annual plans added", "O1", "N1"]) {
    await waitForVisibleText(page, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), 60000);
  }

  const before = await layoutMetrics(page);

  const [mdDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("button", { name: /^MD$/i }).click(),
  ]);
  const md = await readDownload(mdDownload);

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("button", { name: /^CSV$/i }).click(),
  ]);
  const csv = await readDownload(csvDownload);

  const popupPromise = page.waitForEvent("popup", { timeout: 10000 }).catch(() => null);
  await page.getByRole("button", { name: /^N1$/i }).first().click();
  const popup = await popupPromise;
  const popupUrl = popup ? popup.url() : "";
  if (popup) await popup.close().catch(() => undefined);

  const after = await layoutMetrics(page);
  const screenshot = path.join(screenshotDir, `document-diff-result-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();

  return {
    url: page.url(),
    before,
    after,
    md,
    csv,
    popup_url: popupUrl || popups[popups.length - 1] || "",
    screenshot,
    console_errors: consoleErrors,
  };
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-document-diff-result-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-document-diff-result-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (!fixture.user || !fixture.job_id || !fixture.new_document_id) {
    throw new Error("Fixture must include user, job_id, and new_document_id");
  }

  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    job_id: fixture.job_id,
  };
  try {
    report.desktop = await runViewport(
      browser,
      fixture,
      baseUrl,
      screenshotDir,
      "desktop",
      { viewport: { width: 1440, height: 900 } },
    );
    report.mobile = await runViewport(
      browser,
      fixture,
      baseUrl,
      screenshotDir,
      "mobile",
      { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    );
  } finally {
    await browser.close();
  }

  function ok(view) {
    const text = view.after.bodyText;
    const expectedTerms = fixture.expected_terms || ["Refund window extended", "Enterprise annual plans added", "O1", "N1"];
    const exportTerms = fixture.export_terms || ["Refund window extended", "Enterprise annual plans added"];
    return /Completed/i.test(text)
      && expectedTerms.every((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text))
      && view.md.suggested_filename.endsWith(".md")
      && exportTerms.some((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(view.md.preview))
      && view.csv.suggested_filename.endsWith(".csv")
      && exportTerms.some((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(view.csv.preview))
      && view.popup_url.includes(`/d/${fixture.new_document_id}`)
      && view.popup_url.includes(`highlight=${fixture.new_chunk_id}`)
      && !view.after.overflowX
      && view.console_errors.length === 0;
  }

  const desktopOk = ok(report.desktop);
  const mobileOk = ok(report.mobile);
  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    desktop_md_bytes: report.desktop.md.bytes,
    desktop_csv_bytes: report.desktop.csv.bytes,
    mobile_md_bytes: report.mobile.md.bytes,
    mobile_csv_bytes: report.mobile.csv.bytes,
    desktop_popup_url: report.desktop.popup_url,
    mobile_popup_url: report.mobile.popup_url,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: browser document diff result UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser document diff result UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
