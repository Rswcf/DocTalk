#!/usr/bin/env node
/* Non-destructive browser UX checks for the public contact form. */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "../..");
const frontendRequire = createRequire(path.join(ROOT, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

function attachPageObservers(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const contactRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      resource_type: request.resourceType(),
      failure: request.failure()?.errorText || "unknown",
    });
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/contact") {
      let postData = null;
      try {
        postData = request.postDataJSON();
      } catch {
        postData = null;
      }
      contactRequests.push({
        method: request.method(),
        url: request.url(),
        post_data: postData,
      });
    }
  });
  return { consoleErrors, pageErrors, failedRequests, contactRequests };
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const visibleButtons = [...document.querySelectorAll("button")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      })
      .map((button) => (button.textContent || "").trim())
      .filter(Boolean);

    const clippedInteractive = [...document.querySelectorAll("button, a, input, textarea, select")]
      .filter((el) => el.id !== "contact-website" && !el.closest('[aria-hidden="true"]'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = el.getAttribute("aria-label")
          || el.getAttribute("id")
          || el.textContent?.trim()
          || el.getAttribute("href")
          || el.tagName.toLowerCase();
        return { label, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .filter((rect) => rect.left < -1 || rect.right > window.innerWidth + 1);

    return {
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      formPresent: Boolean(document.querySelector("form")),
      visibleButtons,
      clippedInteractive,
    };
  });
}

async function clearForm(page) {
  await page.locator("#contact-name").fill("");
  await page.locator("#contact-email").fill("");
  await page.locator("#contact-message").fill("");
  await page.locator("#contact-website").fill("", { force: true });
}

async function readAlertText(page) {
  const alert = page.getByRole("alert").first();
  try {
    await alert.waitFor({ state: "visible", timeout: 8000 });
    return (await alert.textContent())?.trim() || "";
  } catch {
    return "";
  }
}

async function readStatusText(page) {
  const status = page.getByRole("status").first();
  try {
    await status.waitFor({ state: "visible", timeout: 8000 });
    return (await status.textContent())?.trim() || "";
  } catch {
    return "";
  }
}

async function submitForm(page, { name = "", email, message, website = "" }) {
  await clearForm(page);
  if (name) await page.locator("#contact-name").fill(name);
  await page.locator("#contact-email").fill(email);
  await page.locator("#contact-message").fill(message);
  if (website) {
    await page.locator("#contact-website").fill(website, { force: true });
  }
  await page.getByRole("button", { name: /send message/i }).click();
}

async function runInvalidEmail(page, baseUrl) {
  const responsePromise = page.waitForResponse(
    (response) => response.url() === `${baseUrl}/api/contact` && response.request().method() === "POST",
    { timeout: 10000 },
  );
  await submitForm(page, {
    email: "not-an-email",
    message: "This message is long enough to isolate email validation.",
  });
  const response = await responsePromise;
  const alertText = await readAlertText(page);
  return {
    name: "invalid_email_real_api",
    destructive: false,
    mocked: false,
    response_status: response.status(),
    alert_text: alertText,
    assertions: {
      response_is_400: response.status() === 400,
      alert_mentions_invalid_email: /invalid email/i.test(alertText),
    },
  };
}

async function runShortMessage(page, baseUrl) {
  const responsePromise = page.waitForResponse(
    (response) => response.url() === `${baseUrl}/api/contact` && response.request().method() === "POST",
    { timeout: 10000 },
  );
  await submitForm(page, {
    email: "qa-contact@example.invalid",
    message: "short",
  });
  const response = await responsePromise;
  const alertText = await readAlertText(page);
  return {
    name: "short_message_real_api",
    destructive: false,
    mocked: false,
    response_status: response.status(),
    alert_text: alertText,
    assertions: {
      response_is_400: response.status() === 400,
      alert_mentions_short_message: /too short|minimum/i.test(alertText),
    },
  };
}

async function runHoneypot(page, baseUrl) {
  let intercepted = null;
  await page.route("**/api/contact", async (route) => {
    intercepted = {
      method: route.request().method(),
      post_data: route.request().postDataJSON(),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, mocked_honeypot: true }),
    });
  });
  await submitForm(page, {
    email: "qa-contact@example.invalid",
    message: "This message is valid length, but the hidden website field is filled in a mocked request.",
    website: "https://bot.example.invalid",
  });
  const statusText = await readStatusText(page);
  await page.unroute("**/api/contact");
  return {
    name: "honeypot_mocked_ui",
    destructive: false,
    mocked: true,
    intercepted,
    status_text: statusText,
    assertions: {
      request_was_mocked: Boolean(intercepted),
      honeypot_value_present: intercepted?.post_data?.website === "https://bot.example.invalid",
      status_mentions_success: /thanks|message/i.test(statusText),
    },
  };
}

async function runMockedSuccess(page) {
  let intercepted = null;
  await page.route("**/api/contact", async (route) => {
    intercepted = {
      method: route.request().method(),
      post_data: route.request().postDataJSON(),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, mocked: true }),
    });
  });
  await submitForm(page, {
    name: "QA Contact",
    email: "qa-contact@example.invalid",
    message: "This valid human success path is mocked to avoid sending production email.",
  });
  const statusText = await readStatusText(page);
  const fieldValues = await page.evaluate(() => ({
    name: document.querySelector("#contact-name")?.value || "",
    email: document.querySelector("#contact-email")?.value || "",
    message: document.querySelector("#contact-message")?.value || "",
  }));
  await page.unroute("**/api/contact");
  return {
    name: "mocked_success_ui",
    destructive: false,
    mocked: true,
    intercepted,
    status_text: statusText,
    field_values_after_submit: fieldValues,
    assertions: {
      request_was_mocked: Boolean(intercepted),
      request_method_post: intercepted?.method === "POST",
      status_mentions_success: /thanks|message/i.test(statusText),
      fields_reset_after_success: fieldValues.name === "" && fieldValues.email === "" && fieldValues.message === "",
    },
  };
}

async function runViewport(browser, baseUrl, viewport, screenshotDir) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: "en-US",
  });
  const page = await context.newPage();
  const observers = attachPageObservers(page);
  const result = {
    viewport: viewport.name,
    base_url: baseUrl,
    status: null,
    final_url: null,
    metrics: null,
    scenarios: [],
    console_errors: observers.consoleErrors,
    page_errors: observers.pageErrors,
    failed_requests: observers.failedRequests,
    contact_requests: observers.contactRequests,
    screenshot: null,
    result: "fail",
  };

  try {
    const response = await page.goto(`${baseUrl}/contact`, { waitUntil: "networkidle", timeout: 35000 });
    result.status = response ? response.status() : null;
    result.final_url = page.url();
    await page.getByRole("heading", { name: /contact|support/i }).first().waitFor({ timeout: 30000 });
    result.metrics = await pageMetrics(page);

    result.scenarios.push(await runInvalidEmail(page, baseUrl));
    result.scenarios.push(await runShortMessage(page, baseUrl));
    result.scenarios.push(await runHoneypot(page, baseUrl));
    result.scenarios.push(await runMockedSuccess(page));

    result.metrics_after = await pageMetrics(page);
  } catch (err) {
    result.error = err && err.stack ? err.stack : String(err);
  }

  const assertions = {
    page_loaded: result.status >= 200 && result.status < 400,
    form_present: Boolean(result.metrics?.formPresent),
    h1_present: Boolean(result.metrics?.h1),
    no_horizontal_overflow: result.metrics ? !result.metrics.overflowX : false,
    no_clipped_interactive: result.metrics ? result.metrics.clippedInteractive.length === 0 : false,
    no_unexpected_console_errors: observers.consoleErrors
      .filter((text) => !/Failed to load resource: the server responded with a status of 400/.test(text))
      .length === 0,
    no_page_errors: observers.pageErrors.length === 0,
    no_failed_requests: observers.failedRequests.length === 0,
    scenarios_pass: result.scenarios.every((scenario) => Object.values(scenario.assertions).every(Boolean)),
    no_real_success_contact_request: result.scenarios
      .filter((scenario) => !scenario.mocked && scenario.response_status === 200)
      .length === 0,
  };
  result.assertions = assertions;
  result.result = Object.values(assertions).every(Boolean) ? "pass" : "fail";

  if (result.result !== "pass") {
    const screenshot = path.join(screenshotDir, `production-contact-form-${viewport.name}-failure.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    result.screenshot = path.relative(ROOT, screenshot);
  }

  await context.close();
  return result;
}

async function main() {
  const baseUrl = arg("base-url", "https://www.doctalk.site").replace(/\/$/, "");
  const jsonOut = arg("json-out", ".collab/tasks/qa-production-contact-form-ux-2026-05-11.json");
  const screenshotDir = path.resolve(ROOT, arg("screenshot-dir", ".collab/tasks/screenshots/2026-05-11/production-contact-form"));
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: "desktop", width: 1440, height: 900, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true },
  ];
  const report = {
    run: "qa-production-contact-form-ux",
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    destructive: false,
    safety_note: "Real production API calls cover invalid email and short message only. Honeypot and human success paths are mocked to avoid sending email.",
    viewports,
    results: [],
  };

  try {
    for (const viewport of viewports) {
      report.results.push(await runViewport(browser, baseUrl, viewport, screenshotDir));
    }
  } finally {
    await browser.close();
  }

  report.summary = {
    total: report.results.length,
    passed: report.results.filter((item) => item.result === "pass").length,
    failed: report.results.filter((item) => item.result !== "pass").length,
    real_validation_contact_requests: report.results.reduce(
      (sum, item) => sum + item.scenarios.filter((scenario) => !scenario.mocked).length,
      0,
    ),
    mocked_success_viewports: report.results.filter((item) => item.scenarios.some((scenario) => scenario.name === "mocked_success_ui" && scenario.mocked)).length,
    mocked_honeypot_viewports: report.results.filter((item) => item.scenarios.some((scenario) => scenario.name === "honeypot_mocked_ui" && scenario.mocked)).length,
  };
  report.result = report.summary.failed === 0 ? "pass" : "fail";

  const out = path.resolve(ROOT, jsonOut);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PRODUCTION_CONTACT_FORM_UX ${report.result.toUpperCase()}: ${report.summary.passed}/${report.summary.total} viewports passed`);
  if (report.result !== "pass") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
