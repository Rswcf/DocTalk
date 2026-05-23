#!/usr/bin/env node
/* Authenticated browser smoke checks for all supported UI locales. */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "../..");
const frontendRequire = createRequire(path.join(ROOT, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");
const { encode } = frontendRequire("next-auth/jwt");

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

const ROUTES = [
  { route: "/profile", keys: ["profile.title", "profile.tabs.credits", "profile.plan.pro"] },
  { route: "/billing", keys: ["billing.title", "billing.monthly", "billing.extraTopups"] },
  { route: "/collections", keys: ["collections.title", "collections.create", "collections.emptyTitle"] },
  { route: "/document-diff", keys: ["diff.title", "diff.run", "diff.needTwoDocs"] },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

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

function loadLocale(code) {
  const localePath = path.join(ROOT, "frontend", "src", "i18n", "locales", `${code}.json`);
  return JSON.parse(fs.readFileSync(localePath, "utf8"));
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

async function waitForVisibleText(page, text, timeout = 12000) {
  await page.waitForFunction((needle) => {
    return [...document.querySelectorAll("body *")].some((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (el.textContent || "").includes(needle)
        && style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    });
  }, text, { timeout });
}

async function measure(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const hasScrollableAncestor = (el) => {
      let current = el.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (/(auto|scroll)/.test(style.overflowX) && current.scrollWidth > current.clientWidth + 2) return true;
        current = current.parentElement;
      }
      return false;
    };
    const h1s = [...document.querySelectorAll("h1")].filter(visible).map((el) => (el.textContent || "").trim());
    const clippedInteractive = [...document.querySelectorAll("button,a,input,select,textarea")]
      .filter(visible)
      .filter((el) => !hasScrollableAncestor(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -2 || item.right > window.innerWidth + 2)
      .slice(0, 10);
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir || "ltr",
      title: document.title,
      h1_count: h1s.length,
      h1s,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      clippedInteractive,
      bodyTextLength: document.body.innerText.length,
    };
  });
}

async function runOne(browser, baseUrl, fixture, locale, localeStrings, englishStrings, routeSpec, viewport, screenshotDir) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: locale.code,
  });
  await context.addInitScript((code) => {
    try {
      window.localStorage.setItem("doctalk_locale", code);
      window.localStorage.setItem("doctalk_analytics_consent", "declined");
    } catch {
      // Some browser-internal temporary documents deny localStorage access.
    }
  }, locale.code);
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);

  const page = await context.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning" && msg.text().includes("[i18n]")) consoleWarnings.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  const expectedTexts = routeSpec.keys.map((key) => ({ key, value: localeStrings[key] || englishStrings[key] || key }));
  const untranslatedKeys = routeSpec.keys.filter((key) => locale.code !== "en" && localeStrings[key] === englishStrings[key]);

  let response = null;
  let metrics = null;
  let error = null;
  try {
    response = await page.goto(`${baseUrl}${routeSpec.route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction((code) => document.documentElement.lang === code, locale.code, { timeout: 20000 });
    for (const expected of expectedTexts) {
      await waitForVisibleText(page, expected.value);
    }
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    metrics = await measure(page);
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    metrics = await measure(page).catch(() => null);
  }

  let screenshot = null;
  if (
    (routeSpec.route === "/profile" && locale.code === "ar" && viewport.name === "mobile") ||
    (routeSpec.route === "/billing" && locale.code === "zh" && viewport.name === "desktop") ||
    (routeSpec.route === "/document-diff" && locale.code === "hi" && viewport.name === "mobile")
  ) {
    const slug = routeSpec.route.replace(/^\//, "").replace(/\//g, "-");
    screenshot = path.join(screenshotDir, `auth-locale-${locale.code}-${viewport.name}-${slug}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
  }
  await context.close();

  return {
    locale: locale.code,
    expected_dir: locale.dir,
    route: routeSpec.route,
    viewport: viewport.name,
    status: response ? response.status() : null,
    expected_texts: expectedTexts,
    untranslated_keys: untranslatedKeys,
    metrics,
    screenshot,
    error,
    console_errors: consoleErrors,
    console_warnings: consoleWarnings,
    ok:
      !error &&
      Boolean(response && response.status() >= 200 && response.status() < 400) &&
      metrics?.lang === locale.code &&
      metrics?.dir === locale.dir &&
      metrics?.h1_count >= 1 &&
      !metrics?.overflowX &&
      metrics?.clippedInteractive.length === 0 &&
      consoleErrors.length === 0,
  };
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-authenticated-locale-fixture-2026-05-10.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-authenticated-locale-ui-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const englishStrings = loadLocale("en");
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  try {
    for (const locale of LOCALES) {
      const localeStrings = loadLocale(locale.code);
      for (const routeSpec of ROUTES) {
        for (const viewport of VIEWPORTS) {
          checks.push(await runOne(browser, baseUrl, fixture, locale, localeStrings, englishStrings, routeSpec, viewport, screenshotDir));
        }
      }
    }
  } finally {
    await browser.close();
  }

  const failures = checks.filter((check) => !check.ok);
  const untranslatedCoreKeys = {};
  const missingI18nWarnings = {};
  for (const check of checks) {
    for (const key of check.untranslated_keys) {
      untranslatedCoreKeys[key] = untranslatedCoreKeys[key] || new Set();
      untranslatedCoreKeys[key].add(check.locale);
    }
    for (const warning of check.console_warnings || []) {
      const key = warning.split(":").pop()?.trim();
      if (!key) continue;
      missingI18nWarnings[key] = missingI18nWarnings[key] || new Set();
      missingI18nWarnings[key].add(`${check.locale}:${check.route}:${check.viewport}`);
    }
  }
  const untranslatedCoreKeyReport = Object.fromEntries(
    Object.entries(untranslatedCoreKeys).map(([key, set]) => [key, [...set].sort()])
  );
  const missingI18nWarningReport = Object.fromEntries(
    Object.entries(missingI18nWarnings).map(([key, set]) => [key, [...set].sort()])
  );
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    user_id: fixture.user.id,
    locales: LOCALES.map((l) => l.code),
    routes: ROUTES.map((r) => r.route),
    viewports: VIEWPORTS.map((v) => v.name),
    total_checks: checks.length,
    passed_checks: checks.length - failures.length,
    failed_checks: failures.length,
    untranslated_core_keys: untranslatedCoreKeyReport,
    missing_i18n_warning_keys: missingI18nWarningReport,
    checks,
    result: failures.length === 0 ? "pass" : "fail",
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (failures.length) {
    console.error(`FAIL: authenticated locale UI smoke found ${failures.length} failures; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: authenticated locale UI smoke ${checks.length}/${checks.length}; wrote ${outPath}`);
  if (Object.keys(untranslatedCoreKeyReport).length) {
    console.log(`WARN: untranslated core keys detected: ${Object.keys(untranslatedCoreKeyReport).join(", ")}`);
  }
  if (Object.keys(missingI18nWarningReport).length) {
    console.log(`WARN: i18n fallback warnings detected: ${Object.keys(missingI18nWarningReport).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
