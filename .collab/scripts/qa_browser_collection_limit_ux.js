#!/usr/bin/env node
/* Browser UX check for Free-plan collection/workspace limit. */

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

async function getApiCollections(page, baseUrl) {
  const response = await page.request.get(`${baseUrl}/api/proxy/api/collections`);
  return {
    status: response.status(),
    body: await response.json().catch(async () => ({ text: await response.text() })),
  };
}

async function state(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    return {
      url: window.location.href,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      body: document.body.innerText,
      alertText: [...document.querySelectorAll('[role="alert"]')]
        .filter(visible)
        .map((el) => (el.textContent || "").trim())
        .join("\n"),
      modalOpen: Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
      upgradeLinks: [...document.querySelectorAll("a")]
        .filter(visible)
        .map((el) => ({ text: (el.textContent || "").trim(), href: el.getAttribute("href") || "" }))
        .filter((link) => /upgrade/i.test(link.text) || /collection_limit/.test(link.href)),
    };
  });
}

async function runScenario(browser, fixture, baseUrl, screenshotDir, name, viewportOptions) {
  const scenario = fixture.scenarios[name];
  const context = await browser.newContext({ ...viewportOptions });
  await context.addCookies([await makeCookie(scenario.user, baseUrl)]);
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

  await page.goto(`${baseUrl}/collections`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("heading", { name: /Collections/i }).waitFor({ timeout: 60000 });
  const apiBefore = await getApiCollections(page, baseUrl);
  const before = await state(page);

  await page.getByRole("button", { name: /Create Collection/i }).first().click();
  await page.getByLabel(/Name/i).fill(`Overflow workspace ${name}`);
  await page.getByRole("button", { name: /^Create Collection$/i }).last().click();
  await page.waitForFunction(() => /Collection limit reached|Your plan allows up to/i.test(document.body.innerText), null, {
    timeout: 30000,
  });

  const apiAfter = await getApiCollections(page, baseUrl);
  const after = await state(page);
  const screenshot = path.join(screenshotDir, `collection-limit-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  await context.close();
  return {
    user_id: scenario.user.id,
    expected_collection_count: scenario.max_collections,
    api_before: apiBefore,
    before,
    api_after: apiAfter,
    after,
    screenshot,
    console_errors: consoleErrors,
    ignored_console_errors: ignoredConsoleErrors,
  };
}

function scenarioOk(result) {
  const beforeCollections = Array.isArray(result.api_before.body) ? result.api_before.body : [];
  const afterCollections = Array.isArray(result.api_after.body) ? result.api_after.body : [];
  const hasLimitCopy = /Collection limit reached|Your plan allows up to 1 collections/i.test(result.after.alertText);
  const hasUpgrade = result.after.upgradeLinks.some((link) => /collection_limit/.test(link.href) && /billing/.test(link.href));
  return result.api_before.status === 200
    && result.api_after.status === 200
    && beforeCollections.length === result.expected_collection_count
    && afterCollections.length === result.expected_collection_count
    && hasLimitCopy
    && hasUpgrade
    && result.after.modalOpen
    && !result.before.overflowX
    && !result.after.overflowX
    && result.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-collection-limit-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-collection-limit-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
  };
  try {
    report.desktop = await runScenario(browser, fixture, baseUrl, screenshotDir, "desktop", { viewport: { width: 1440, height: 900 } });
    report.mobile = await runScenario(browser, fixture, baseUrl, screenshotDir, "mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  } finally {
    await browser.close();
  }

  report.summary = {
    desktop_ok: scenarioOk(report.desktop),
    mobile_ok: scenarioOk(report.mobile),
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
    ignored_expected_403_console_errors:
      report.desktop.ignored_console_errors.length + report.mobile.ignored_console_errors.length,
  };
  report.result = report.summary.desktop_ok && report.summary.mobile_ok ? "pass" : "fail";
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== "pass") {
    console.error(`FAIL: browser collection-limit UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser collection-limit UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
