#!/usr/bin/env node
/* Verify auth UI only exposes providers actually enabled by Auth.js. */

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

function attachConsole(page) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  return consoleErrors;
}

async function visible(page, role, options) {
  try {
    const locator = page.getByRole(role, options);
    await locator.first().waitFor({ state: "visible", timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

async function runViewport(browser, baseUrl, mode) {
  const context = await browser.newContext(
    mode === "mobile"
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } }
  );
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);

  const providersRes = await page.request.get(`${baseUrl}/api/auth/providers`);
  const providers = providersRes.ok() ? await providersRes.json() : {};
  const providerIds = Object.keys(providers);

  const response = await page.goto(`${baseUrl}/auth?callbackUrl=/document-diff`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: /sign in/i }).first().waitFor({ timeout: 30000 });

  const controls = {
    google: await visible(page, "button", { name: /continue with google/i }),
    microsoft: await visible(page, "button", { name: /continue with microsoft/i }),
    emailInput: await visible(page, "textbox", { name: /email/i }),
    emailButton: await visible(page, "button", { name: /continue with email/i }),
  };
  const metrics = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    buttons: [...document.querySelectorAll("button")]
      .map((button) => (button.textContent || "").trim())
      .filter(Boolean),
  }));

  await context.close();
  return {
    mode,
    status: response ? response.status() : null,
    provider_status: providersRes.status(),
    provider_ids: providerIds,
    controls,
    metrics,
    console_errors: consoleErrors,
    assertions: {
      google_matches_provider: controls.google === providerIds.includes("google"),
      microsoft_matches_provider: controls.microsoft === providerIds.includes("microsoft-entra-id"),
      email_input_matches_provider: controls.emailInput === providerIds.includes("resend"),
      email_button_matches_provider: controls.emailButton === providerIds.includes("resend"),
      no_horizontal_overflow: !metrics.overflowX,
      no_console_errors: consoleErrors.length === 0,
    },
  };
}

async function main() {
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const jsonOut = arg("json-out", ".collab/tasks/qa-auth-provider-availability-ux-2026-05-11.json");
  const browser = await chromium.launch();
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    desktop: null,
    mobile: null,
  };
  try {
    report.desktop = await runViewport(browser, baseUrl, "desktop");
    report.mobile = await runViewport(browser, baseUrl, "mobile");
  } finally {
    await browser.close();
  }
  const allAssertions = [report.desktop, report.mobile].flatMap((item) => Object.values(item.assertions));
  report.result = allAssertions.every(Boolean) ? "pass" : "fail";
  report.summary = {
    desktop_provider_ids: report.desktop.provider_ids,
    mobile_provider_ids: report.mobile.provider_ids,
    desktop_controls: report.desktop.controls,
    mobile_controls: report.mobile.controls,
  };

  const out = path.resolve(ROOT, jsonOut);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`AUTH_PROVIDER_AVAILABILITY ${report.result.toUpperCase()}: wrote ${jsonOut}`);
  if (report.result !== "pass") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
