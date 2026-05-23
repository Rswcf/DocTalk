#!/usr/bin/env node
/* Browser UX checks for auth pages and admin access-control/dashboard flows. */

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
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    };
    const headings = [...document.querySelectorAll("h1,h2")]
      .filter(visible)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || "").trim().slice(0, 100) }))
      .slice(0, 12);
    const clippedInteractive = [...document.querySelectorAll("button,a,input,select,textarea")]
      .filter(visible)
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
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      headings,
      clippedInteractive,
    };
  });
}

function noOverflow(metrics) {
  return metrics && !metrics.overflowX && (!metrics.clippedInteractive || metrics.clippedInteractive.length === 0);
}

async function runAuthPages(browser, baseUrl, screenshotDir, report, mode) {
  const context = await browser.newContext(mode === "mobile"
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);
  const auth = await page.goto(`${baseUrl}/auth?callbackUrl=/document-diff`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /Sign In/);
  await page.getByRole("button", { name: /Continue with Google/i }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Continue with Microsoft/i }).waitFor({ timeout: 10000 });
  await page.getByRole("textbox").fill("qa-auth@example.com");
  await page.getByRole("button", { name: /Continue with Email/i }).waitFor({ timeout: 10000 });
  const authMetrics = await layoutMetrics(page);
  const authScreenshot = path.join(screenshotDir, `auth-page-${mode}.png`);
  await page.screenshot({ path: authScreenshot, fullPage: false });

  const errorPage = await context.newPage();
  const errorConsoleErrors = attachConsole(errorPage);
  const errorRes = await errorPage.goto(`${baseUrl}/auth/error?error=AccessDenied`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(errorPage, /Access was denied/);
  const errorMetrics = await layoutMetrics(errorPage);

  const verifyPage = await context.newPage();
  const verifyConsoleErrors = attachConsole(verifyPage);
  const verifyRes = await verifyPage.goto(`${baseUrl}/auth/verify-request`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(verifyPage, /Check your email/);
  const verifyMetrics = await layoutMetrics(verifyPage);

  report[`auth_${mode}`] = {
    auth_status: auth ? auth.status() : null,
    auth_url: page.url(),
    auth_metrics: authMetrics,
    auth_screenshot: authScreenshot,
    error_status: errorRes ? errorRes.status() : null,
    error_metrics: errorMetrics,
    verify_status: verifyRes ? verifyRes.status() : null,
    verify_metrics: verifyMetrics,
    console_errors: consoleErrors,
    error_console_errors: errorConsoleErrors,
    verify_console_errors: verifyConsoleErrors,
  };

  await context.close();
}

async function apiStatus(page, baseUrl, path) {
  const res = await page.request.get(`${baseUrl}/api/proxy${path}`);
  return res.status();
}

async function runAdmin(browser, fixture, baseUrl, screenshotDir, report, mode) {
  const contextOptions = mode === "mobile"
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } };

  const anonContext = await browser.newContext(contextOptions);
  const anonPage = await anonContext.newPage();
  const anonConsoleErrors = attachConsole(anonPage);
  await anonPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await anonPage.waitForURL((url) => (
    url.pathname === "/auth"
    && (url.searchParams.get("callbackUrl") === "/admin" || url.href.includes("callbackUrl=%2Fadmin"))
  ), { timeout: 30000 });
  await waitForVisibleText(anonPage, /Sign In/);
  const anonMetrics = await layoutMetrics(anonPage);
  await anonContext.close();

  const regularContext = await browser.newContext(contextOptions);
  await regularContext.addCookies([await makeCookie(fixture.regular_user, baseUrl)]);
  const regularPage = await regularContext.newPage();
  const regularConsoleErrors = attachConsole(regularPage);
  const regularApi = await apiStatus(regularPage, baseUrl, "/api/admin/overview");
  await regularPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await regularPage.waitForURL(`${baseUrl}/`, { timeout: 30000 });
  const regularMetrics = await layoutMetrics(regularPage);
  await regularContext.close();

  const adminContext = await browser.newContext(contextOptions);
  await adminContext.addCookies([await makeCookie(fixture.admin_user, baseUrl)]);
  const adminPage = await adminContext.newPage();
  const adminConsoleErrors = attachConsole(adminPage);
  const adminRes = await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(adminPage, /Admin Dashboard/);
  await waitForVisibleText(adminPage, /Billing Health/);
  await waitForVisibleText(adminPage, /Monetization Funnel/);
  await waitForVisibleText(adminPage, /RAG Quality/);
  await waitForVisibleText(adminPage, /Recent Users/);
  await waitForVisibleText(adminPage, /Top Users/);

  const api = {};
  for (const endpoint of [
    "/api/admin/overview",
    "/api/admin/trends",
    "/api/admin/breakdowns",
    "/api/admin/billing-health",
    "/api/admin/funnel",
    "/api/admin/rag-quality",
    "/api/admin/recent-users",
    "/api/admin/top-users",
  ]) {
    api[endpoint] = await apiStatus(adminPage, baseUrl, endpoint);
  }

  await adminPage.getByLabel(/Sort by/i).selectOption("documents");
  await waitForVisibleText(adminPage, /By Documents/);
  const verifyStripeButton = adminPage.getByRole("button", { name: /Verify Stripe/i });
  const verifyStripeVisible = await verifyStripeButton.isVisible();
  const adminMetrics = await layoutMetrics(adminPage);
  const adminScreenshot = path.join(screenshotDir, `admin-${mode}.png`);
  await adminPage.screenshot({ path: adminScreenshot, fullPage: false });

  report[`admin_${mode}`] = {
    anonymous_redirect_url: anonPage.url(),
    anonymous_metrics: anonMetrics,
    regular_api_status: regularApi,
    regular_redirect_url: regularPage.url(),
    regular_metrics: regularMetrics,
    admin_status: adminRes ? adminRes.status() : null,
    admin_url: adminPage.url(),
    admin_api_statuses: api,
    verify_stripe_visible: verifyStripeVisible,
    admin_metrics: adminMetrics,
    admin_screenshot: adminScreenshot,
    anonymous_console_errors: anonConsoleErrors,
    regular_console_errors: regularConsoleErrors,
    admin_console_errors: adminConsoleErrors,
  };

  await adminContext.close();
}

function validAuth(result) {
  return result.auth_status === 200
    && result.error_status === 200
    && result.verify_status === 200
    && noOverflow(result.auth_metrics)
    && noOverflow(result.error_metrics)
    && noOverflow(result.verify_metrics)
    && result.console_errors.length === 0
    && result.error_console_errors.length === 0
    && result.verify_console_errors.length === 0;
}

function validAdmin(result, baseUrl) {
  const anonUrl = new URL(result.anonymous_redirect_url);
  const regularConsoleOk = result.regular_console_errors.every((text) => (
    /Failed to load resource: the server responded with a status of 403/.test(text)
  ));
  return anonUrl.origin === baseUrl
    && anonUrl.pathname === "/auth"
    && (anonUrl.searchParams.get("callbackUrl") === "/admin" || result.anonymous_redirect_url.includes("callbackUrl=%2Fadmin"))
    && result.regular_api_status === 403
    && result.regular_redirect_url === `${baseUrl}/`
    && result.admin_status === 200
    && Object.values(result.admin_api_statuses).every((status) => status === 200)
    && result.verify_stripe_visible === true
    && noOverflow(result.anonymous_metrics)
    && noOverflow(result.regular_metrics)
    && noOverflow(result.admin_metrics)
    && result.anonymous_console_errors.length === 0
    && regularConsoleOk
    && result.admin_console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-auth-admin-fixture-2026-05-10.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-auth-admin-ux-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    admin_created: fixture.admin_created,
    admin_user_id: fixture.admin_user.id,
    regular_user_id: fixture.regular_user.id,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    await runAuthPages(browser, baseUrl, screenshotDir, report, "desktop");
    await runAuthPages(browser, baseUrl, screenshotDir, report, "mobile");
    await runAdmin(browser, fixture, baseUrl, screenshotDir, report, "desktop");
    await runAdmin(browser, fixture, baseUrl, screenshotDir, report, "mobile");
  } finally {
    await browser.close();
  }

  const ok = validAuth(report.auth_desktop)
    && validAuth(report.auth_mobile)
    && validAdmin(report.admin_desktop, baseUrl)
    && validAdmin(report.admin_mobile, baseUrl);
  report.result = ok ? "pass" : "fail";

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
