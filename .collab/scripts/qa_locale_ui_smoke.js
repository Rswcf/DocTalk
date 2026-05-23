#!/usr/bin/env node
/* Browser smoke checks for all supported UI locales. */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "../..");
const frontendRequire = createRequire(path.join(ROOT, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");

const LOCALES = [
  { code: "en", dir: "ltr" },
  { code: "zh", dir: "ltr" },
  { code: "es", dir: "ltr" },
  { code: "ja", dir: "ltr" },
  { code: "de", dir: "ltr" },
  { code: "fr", dir: "ltr" },
  { code: "ko", dir: "ltr" },
  { code: "pt", dir: "ltr" },
  { code: "it", dir: "ltr" },
  { code: "ar", dir: "rtl" },
  { code: "hi", dir: "ltr" },
];

const ROUTES = ["/", "/pricing", "/demo"];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

async function measure(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const h1s = [...document.querySelectorAll("h1")].filter(visible).map((el) => (el.textContent || "").trim());
    const overflowing = [...document.querySelectorAll("body *")].filter((el) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      return rect.right > window.innerWidth + 2 || rect.left < -2;
    }).slice(0, 8).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 80),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      };
    });
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir || "ltr",
      title: document.title,
      h1_count: h1s.length,
      h1s,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      overflowing,
      bodyTextLength: document.body.innerText.length,
    };
  });
}

async function runOne(browser, baseUrl, locale, route, viewport, screenshotDir) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: locale.code,
  });
  await context.addInitScript((code) => {
    window.localStorage.setItem("doctalk_locale", code);
  }, locale.code);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction((code) => document.documentElement.lang === code, locale.code, { timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  const metrics = await measure(page);
  let screenshot = null;
  if (
    route === "/" &&
    ((locale.code === "en" && viewport.name === "desktop") ||
      (locale.code === "zh" && viewport.name === "mobile") ||
      (locale.code === "ar" && viewport.name === "mobile"))
  ) {
    screenshot = path.join(screenshotDir, `locale-${locale.code}-${viewport.name}-home.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
  }
  await context.close();

  return {
    locale: locale.code,
    expected_dir: locale.dir,
    route,
    viewport: viewport.name,
    status: response ? response.status() : null,
    metrics,
    screenshot,
    console_errors: consoleErrors,
    ok:
      Boolean(response && response.status() >= 200 && response.status() < 400) &&
      metrics.lang === locale.code &&
      metrics.dir === locale.dir &&
      metrics.h1_count >= 1 &&
      !metrics.overflowX &&
      consoleErrors.length === 0,
  };
}

async function main() {
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-locale-ui-smoke-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const checks = [];
  try {
    for (const locale of LOCALES) {
      for (const route of ROUTES) {
        for (const viewport of VIEWPORTS) {
          checks.push(await runOne(browser, baseUrl, locale, route, viewport, screenshotDir));
        }
      }
    }
  } finally {
    await browser.close();
  }

  const failures = checks.filter((check) => !check.ok);
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    locales: LOCALES.map((l) => l.code),
    routes: ROUTES,
    viewports: VIEWPORTS.map((v) => v.name),
    total_checks: checks.length,
    passed_checks: checks.length - failures.length,
    failed_checks: failures.length,
    checks,
    result: failures.length === 0 ? "pass" : "fail",
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (failures.length) {
    console.error(`FAIL: locale UI smoke found ${failures.length} failures; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: locale UI smoke ${checks.length}/${checks.length}; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
