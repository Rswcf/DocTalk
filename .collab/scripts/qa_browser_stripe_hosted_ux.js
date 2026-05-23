#!/usr/bin/env node
/* Browser click-through checks for hosted Stripe Checkout and Billing Portal. */

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
    const clippedInteractive = [...document.querySelectorAll("button,a,input,select,textarea")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 80),
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
      clippedInteractive,
      buttons: [...document.querySelectorAll("button")].filter(visible).map((button) => (
        button.textContent || button.getAttribute("aria-label") || ""
      ).trim()).filter(Boolean).slice(0, 20),
    };
  });
}

async function localProfile(context, baseUrl) {
  const response = await context.request.get(`${baseUrl}/api/proxy/api/users/profile`);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = { text: await response.text() };
  }
  return { status: response.status(), body };
}

async function findUsableButton(page, patterns) {
  const diagnostics = [];
  for (const pattern of patterns) {
    const locator = page.locator("button").filter({ hasText: pattern });
    const count = await locator.count();
    for (let idx = 0; idx < count; idx += 1) {
      const candidate = locator.nth(idx);
      const text = ((await candidate.textContent().catch(() => "")) || "").trim().replace(/\s+/g, " ");
      const visible = await candidate.isVisible().catch(() => false);
      const enabled = await candidate.isEnabled().catch(() => false);
      const box = await candidate.boundingBox().catch(() => null);
      diagnostics.push({ pattern: String(pattern), idx, text, visible, enabled, box });
      if (!visible || !enabled || !box) continue;
      await candidate.scrollIntoViewIfNeeded();
      try {
        await candidate.click({ trial: true, timeout: 5000 });
        return { locator: candidate, target: { pattern: String(pattern), idx, text, box } };
      } catch (error) {
        diagnostics[diagnostics.length - 1].trial_error = error && error.message ? error.message : String(error);
      }
    }
  }
  throw new Error(`No usable button found. candidates=${JSON.stringify(diagnostics)}`);
}

async function runFlow(browser, baseUrl, screenshotDir, flow) {
  const context = await browser.newContext({
    viewport: flow.viewport,
    locale: "en-US",
  });
  await context.addCookies([await makeCookie(flow.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);

  const session = await page.request.get(`${baseUrl}/api/auth/session`);
  const profileBefore = await localProfile(context, baseUrl);
  const response = await page.goto(`${baseUrl}/billing`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /Billing|Plans and credits|Subscription plans/i);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  const beforeMetrics = await layoutMetrics(page);
  const beforeScreenshot = path.join(screenshotDir, `stripe-hosted-${flow.name}-before.png`);
  await page.screenshot({ path: beforeScreenshot, fullPage: false });

  let clicked = false;
  let clickTarget = null;
  let localResponseSummary = null;
  let expectedHost = null;
  if (flow.kind === "checkout") {
    expectedHost = "checkout.stripe.com";
    const button = await findUsableButton(page, [/^Upgrade Plus$/i, /Upgrade\s+Plus/i]);
    clickTarget = button.target;
    const [localResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/proxy/api/billing/subscribe"), { timeout: 30000 }),
      button.locator.click({ timeout: 30000 }),
    ]);
    localResponseSummary = {
      status: localResponse.status(),
      url: localResponse.url(),
      content_type: localResponse.headers()["content-type"] || null,
    };
    clicked = true;
  } else {
    expectedHost = "billing.stripe.com";
    const button = await findUsableButton(page, [/^Manage$/i, /Manage\s+subscription/i]);
    clickTarget = button.target;
    const [localResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/proxy/api/billing/portal"), { timeout: 30000 }),
      button.locator.click({ timeout: 30000 }),
    ]);
    localResponseSummary = {
      status: localResponse.status(),
      url: localResponse.url(),
      content_type: localResponse.headers()["content-type"] || null,
    };
    clicked = true;
  }

  await page.waitForURL((url) => url.hostname === expectedHost, { timeout: 45000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => undefined);
  const hostedUrl = page.url();
  const hostedTitle = await page.title().catch(() => "");
  const hostedScreenshot = path.join(screenshotDir, `stripe-hosted-${flow.name}-hosted.png`);
  await page.screenshot({ path: hostedScreenshot, fullPage: false }).catch(() => undefined);
  const profileAfter = await localProfile(context, baseUrl);

  await context.close();
  return {
    name: flow.name,
    kind: flow.kind,
    viewport: flow.viewport,
    auth_session_status: session.status(),
    billing_status: response ? response.status() : null,
    profile_before: {
      status: profileBefore.status,
      plan: profileBefore.body && profileBefore.body.plan,
      billing_state: profileBefore.body && profileBefore.body.billing_state,
    },
    profile_after: {
      status: profileAfter.status,
      plan: profileAfter.body && profileAfter.body.plan,
      billing_state: profileAfter.body && profileAfter.body.billing_state,
    },
    clicked,
    click_target: clickTarget,
    local_response: localResponseSummary,
    hosted: {
      url: hostedUrl.replace(/\?.*$/, "?<redacted>"),
      host: new URL(hostedUrl).hostname,
      path_prefix: new URL(hostedUrl).pathname.split("/").slice(0, 3).join("/"),
      title: hostedTitle,
      screenshot: hostedScreenshot,
    },
    before_metrics: beforeMetrics,
    before_screenshot: beforeScreenshot,
    console_errors: consoleErrors,
  };
}

function hasLayoutPass(result) {
  return !result.before_metrics.overflowX && result.before_metrics.clippedInteractive.length === 0;
}

function flowPass(result) {
  const expectedHost = result.kind === "checkout" ? "checkout.stripe.com" : "billing.stripe.com";
  const localOk = result.local_response && result.local_response.status === 200;
  const hostedOk = result.hosted && result.hosted.host === expectedHost;
  const sessionOk = result.auth_session_status === 200;
  const billingOk = result.billing_status === 200;
  const layoutOk = hasLayoutPass(result);
  const consoleOk = result.console_errors.length === 0;
  if (result.kind === "checkout") {
    return sessionOk
      && billingOk
      && localOk
      && hostedOk
      && layoutOk
      && consoleOk
      && result.profile_after.billing_state
      && result.profile_after.billing_state.status === "pending";
  }
  return sessionOk
    && billingOk
    && localOk
    && hostedOk
    && layoutOk
    && consoleOk
    && result.profile_before.billing_state
    && result.profile_before.billing_state.managed_by === "stripe";
}

async function main() {
  const baseUrl = arg("base-url", "http://localhost:3000");
  const fixturePath = arg("fixture");
  const jsonOut = arg("json-out");
  const screenshotDir = arg("screenshot-dir", path.join(ROOT, ".collab", "tasks", "screenshots", "2026-05-10"));
  if (!fixturePath || !jsonOut) throw new Error("--fixture and --json-out are required");
  fs.mkdirSync(screenshotDir, { recursive: true });
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture: fixturePath,
    flows: [],
  };

  try {
    const flows = [
      {
        name: "checkout-desktop",
        kind: "checkout",
        user: fixture.users.checkout_desktop,
        viewport: { width: 1440, height: 900 },
      },
      {
        name: "checkout-mobile",
        kind: "checkout",
        user: fixture.users.checkout_mobile,
        viewport: { width: 390, height: 844 },
      },
      {
        name: "portal-desktop",
        kind: "portal",
        user: fixture.users.portal_desktop,
        viewport: { width: 1440, height: 900 },
      },
      {
        name: "portal-mobile",
        kind: "portal",
        user: fixture.users.portal_mobile,
        viewport: { width: 390, height: 844 },
      },
    ];
    for (const flow of flows) {
      try {
        const result = await runFlow(browser, baseUrl, screenshotDir, flow);
        result.result = flowPass(result) ? "pass" : "fail";
        report.flows.push(result);
      } catch (error) {
        report.flows.push({
          name: flow.name,
          kind: flow.kind,
          viewport: flow.viewport,
          result: "fail",
          error: error && error.stack ? error.stack : String(error),
        });
      }
    }
    report.result = report.flows.every((flow) => flow.result === "pass") ? "pass" : "fail";
  } finally {
    await browser.close();
  }

  fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  const passed = report.flows.filter((flow) => flow.result === "pass").length;
  console.log(`STRIPE_HOSTED_BROWSER ${report.result.toUpperCase()}: ${passed}/${report.flows.length} flows`);
  if (report.result !== "pass") process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
