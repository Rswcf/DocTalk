#!/usr/bin/env node
/* Browser UX checks for the Billing cancel confirmation modal. */

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
    ...readEnv(path.join(ROOT, ".env")),
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
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 100),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -2 || item.right > window.innerWidth + 2)
      .slice(0, 20);
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      clippedInteractive,
    };
  });
}

async function modalState(page) {
  return await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    };
    const radios = dialog
      ? [...dialog.querySelectorAll('[role="radio"]')].map((el) => ({
        text: (el.textContent || "").trim().replace(/\s+/g, " "),
        checked: el.getAttribute("aria-checked") === "true",
      }))
      : [];
    const textarea = dialog ? dialog.querySelector("#cancel-feedback") : null;
    const checkbox = dialog ? dialog.querySelector('input[type="checkbox"]') : null;
    return {
      open: visible(dialog),
      text: dialog ? (dialog.textContent || "").trim().replace(/\s+/g, " ") : "",
      radios,
      radio_count: radios.length,
      textarea_present: Boolean(textarea),
      textarea_max_length: textarea ? textarea.getAttribute("maxlength") : null,
      checkbox_present: Boolean(checkbox),
      checkbox_checked: checkbox ? checkbox.checked : false,
    };
  });
}

async function pageState(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    };
    const currentPlan = [...document.querySelectorAll("section")]
      .find((el) => /Your current plan/i.test(el.textContent || "") && visible(el));
    return {
      url: window.location.href,
      body_excerpt: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 3000),
      current_plan_visible: Boolean(currentPlan),
      current_plan_text: currentPlan ? (currentPlan.textContent || "").trim().replace(/\s+/g, " ") : "",
      success_visible: /You're now on the Free plan|refund request was recorded/i.test(document.body.innerText || ""),
      free_plan_visible: /Current Plan|Free/i.test(document.body.innerText || ""),
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

function requestSummary(request) {
  let body = null;
  try {
    body = request.postDataJSON();
  } catch {
    body = request.postData();
  }
  return {
    method: request.method(),
    url: request.url(),
    body,
  };
}

async function runScenario(browser, fixture, baseUrl, screenshotDir, name, viewportOptions) {
  const scenario = fixture.scenarios[name];
  const context = await browser.newContext({
    ...viewportOptions,
    locale: "en-US",
  });
  await context.addCookies([await makeCookie(scenario.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);
  const cancelRequests = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/proxy/api/billing/cancel")) {
      cancelRequests.push(requestSummary(request));
    }
  });

  const session = await page.request.get(`${baseUrl}/api/auth/session`);
  const profileBefore = await localProfile(context, baseUrl);
  const response = await page.goto(`${baseUrl}/billing`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitForVisibleText(page, /Your current plan|Return to Free plan/i, 60000);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  const beforeMetrics = await layoutMetrics(page);
  const beforePageState = await pageState(page);
  const beforeScreenshot = path.join(screenshotDir, `billing-cancel-${name}-before.png`);
  await page.screenshot({ path: beforeScreenshot, fullPage: false });

  await page.getByRole("button", { name: /^Return to Free plan$/i }).click();
  await page.getByRole("dialog", { name: /Cancel subscription/i }).waitFor({ timeout: 30000 });
  const modalInitial = await modalState(page);
  const modalMetrics = await layoutMetrics(page);
  const modalScreenshot = path.join(screenshotDir, `billing-cancel-${name}-modal.png`);
  await page.screenshot({ path: modalScreenshot, fullPage: false });

  await page.getByRole("button", { name: /^Back$/i }).click();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-modal="true"]'), null, { timeout: 10000 });
  const afterBack = {
    modal: await modalState(page),
    cancel_request_count: cancelRequests.length,
    profile: await localProfile(context, baseUrl),
    metrics: await layoutMetrics(page),
  };

  await page.getByRole("button", { name: /^Return to Free plan$/i }).click();
  await page.getByRole("dialog", { name: /Cancel subscription/i }).waitFor({ timeout: 30000 });
  await page.getByRole("radio", { name: /^Answers or citations were not good enough$/i }).click();
  await page.getByLabel(/Anything we should understand/i).fill("QA browser cancellation feedback");
  await page.getByLabel(/Request a refund review/i).check();
  const modalFilled = await modalState(page);

  const cancelResponsePromise = page.waitForResponse((res) => res.url().includes("/api/proxy/api/billing/cancel"), { timeout: 30000 });
  await page.getByRole("button", { name: /^Confirm cancellation$/i }).click();
  const cancelResponse = await cancelResponsePromise;
  const cancelResponseBody = await cancelResponse.json().catch(async () => ({ text: await cancelResponse.text() }));
  await waitForVisibleText(page, /You're now on the Free plan|refund request was recorded/i, 30000);
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-modal="true"]'), null, { timeout: 10000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  const profileAfter = await localProfile(context, baseUrl);
  const afterPageState = await pageState(page);
  const afterMetrics = await layoutMetrics(page);
  const afterScreenshot = path.join(screenshotDir, `billing-cancel-${name}-after.png`);
  await page.screenshot({ path: afterScreenshot, fullPage: false });

  await context.close();
  return {
    name,
    user_id: scenario.user.id,
    auth_session_status: session.status(),
    billing_status: response ? response.status() : null,
    profile_before: {
      status: profileBefore.status,
      plan: profileBefore.body && profileBefore.body.plan,
      billing_state: profileBefore.body && profileBefore.body.billing_state,
    },
    before: {
      page: beforePageState,
      metrics: beforeMetrics,
      screenshot: beforeScreenshot,
    },
    modal_initial: {
      ...modalInitial,
      metrics: modalMetrics,
      screenshot: modalScreenshot,
    },
    after_back: afterBack,
    modal_filled: modalFilled,
    cancel_response: {
      status: cancelResponse.status(),
      body: cancelResponseBody,
    },
    cancel_requests: cancelRequests,
    profile_after: {
      status: profileAfter.status,
      plan: profileAfter.body && profileAfter.body.plan,
      billing_state: profileAfter.body && profileAfter.body.billing_state,
    },
    after: {
      page: afterPageState,
      metrics: afterMetrics,
      screenshot: afterScreenshot,
    },
    console_errors: consoleErrors,
  };
}

async function runScenarioSafely(browser, fixture, baseUrl, screenshotDir, name, viewportOptions) {
  try {
    const result = await runScenario(browser, fixture, baseUrl, screenshotDir, name, viewportOptions);
    result.result = scenarioPass(result) ? "pass" : "fail";
    return result;
  } catch (error) {
    return {
      name,
      result: "fail",
      error: error && error.stack ? error.stack : String(error),
    };
  }
}

function scenarioPass(result) {
  const request = result.cancel_requests[result.cancel_requests.length - 1];
  return result.auth_session_status === 200
    && result.billing_status === 200
    && result.profile_before.status === 200
    && result.profile_before.plan === "plus"
    && result.profile_before.billing_state
    && result.profile_before.billing_state.managed_by === "admin"
    && result.profile_before.billing_state.can_cancel === true
    && !result.before.metrics.overflowX
    && result.before.metrics.clippedInteractive.length === 0
    && result.before.page.current_plan_visible
    && /Return to Free plan/i.test(result.before.page.current_plan_text)
    && result.modal_initial.open
    && result.modal_initial.radio_count === 8
    && result.modal_initial.radios.some((radio) => radio.text === "Answers or citations were not good enough")
    && /You'll return to the Free plan immediately/i.test(result.modal_initial.text)
    && /Request a refund review/i.test(result.modal_initial.text)
    && /Cancellation is not blocked/i.test(result.modal_initial.text)
    && result.modal_initial.textarea_present
    && result.modal_initial.textarea_max_length === "1000"
    && result.modal_initial.checkbox_present
    && !result.modal_initial.metrics.overflowX
    && result.modal_initial.metrics.clippedInteractive.length === 0
    && result.after_back.cancel_request_count === 0
    && !result.after_back.modal.open
    && result.after_back.profile.status === 200
    && result.after_back.profile.body
    && result.after_back.profile.body.plan === "plus"
    && result.modal_filled.radios.some((radio) => radio.text === "Answers or citations were not good enough" && radio.checked)
    && result.modal_filled.checkbox_checked
    && result.cancel_response.status === 200
    && result.cancel_response.body.status === "immediate_revert"
    && result.cancel_response.body.refund_requested === true
    && result.cancel_requests.length === 1
    && request
    && request.method === "POST"
    && request.body
    && request.body.reason === "answer_quality"
    && request.body.feedback === "QA browser cancellation feedback"
    && request.body.refund_requested === true
    && result.profile_after.status === 200
    && result.profile_after.plan === "free"
    && result.profile_after.billing_state
    && result.profile_after.billing_state.managed_by === "none"
    && !result.after.metrics.overflowX
    && result.after.metrics.clippedInteractive.length === 0
    && !/Your current plan/i.test(result.after.page.current_plan_text)
    && result.after.page.success_visible
    && result.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture");
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const outPath = arg("json-out");
  const screenshotDir = arg("screenshot-dir", path.join(ROOT, ".collab", "tasks", "screenshots", "2026-05-11"));
  if (!fixturePath || !outPath) throw new Error("--fixture and --json-out are required");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
  };

  try {
    report.desktop = await runScenarioSafely(browser, fixture, baseUrl, screenshotDir, "desktop", { viewport: { width: 1440, height: 900 } });
    report.mobile = await runScenarioSafely(browser, fixture, baseUrl, screenshotDir, "mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  } finally {
    await browser.close();
  }

  report.summary = {
    desktop_ok: report.desktop.result === "pass",
    mobile_ok: report.mobile.result === "pass",
    desktop_console_errors: report.desktop.console_errors ? report.desktop.console_errors.length : null,
    mobile_console_errors: report.mobile.console_errors ? report.mobile.console_errors.length : null,
  };
  report.result = report.summary.desktop_ok && report.summary.mobile_ok ? "pass" : "fail";
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== "pass") {
    console.error(`FAIL: browser Billing cancel UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser Billing cancel UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
