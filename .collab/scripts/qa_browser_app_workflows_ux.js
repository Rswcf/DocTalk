#!/usr/bin/env node
/* Browser UX checks for authenticated app workflows beyond the reader. */

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function gotoAndSettle(page, url, pattern) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  if (pattern) await waitForVisibleText(page, pattern);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  return response ? response.status() : null;
}

async function layoutMetrics(page) {
  return await page.evaluate(() => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    };
    const clippedInteractive = [...document.querySelectorAll("button,a,input,select,textarea")]
      .filter(isVisible)
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
    const headings = [...document.querySelectorAll("h1,h2")]
      .filter(isVisible)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || "").trim().slice(0, 120) }))
      .slice(0, 8);
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      headings,
      clippedInteractive,
      dialogCount: [...document.querySelectorAll('[role="dialog"]')].filter(isVisible).length,
    };
  });
}

function attachConsole(page) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  return consoleErrors;
}

async function downloadSummary(download) {
  const filePath = await download.path();
  const bytes = fs.statSync(filePath).size;
  const raw = fs.readFileSync(filePath, "utf8");
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  return {
    suggested_filename: download.suggestedFilename(),
    bytes,
    json_keys: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 20) : [],
    email: parsed && typeof parsed === "object" ? parsed.email || parsed.user?.email || null : null,
  };
}

async function exportResponseSummary(response) {
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const headers = response.headers();
  return {
    status: response.status(),
    bytes: Buffer.byteLength(raw),
    content_type: headers["content-type"] || null,
    content_disposition: headers["content-disposition"] || null,
    json_keys: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 20) : [],
    email: parsed && typeof parsed === "object" ? parsed.email || parsed.user?.email || null : null,
    error: parsed && typeof parsed === "object" ? parsed.error || null : null,
  };
}

function collectionIdFromUrl(rawUrl) {
  const match = new URL(rawUrl).pathname.match(/^\/collections\/([0-9a-f-]{36})$/i);
  if (!match) throw new Error(`Could not extract collection id from ${rawUrl}`);
  return match[1];
}

async function getSelectStats(page) {
  return await page.evaluate(() => [...document.querySelectorAll("select")].map((select) => ({
    value: select.value,
    options: [...select.options].map((option) => ({ value: option.value, text: option.textContent || "" })),
  })));
}

async function diffPanelCompareEnabled(page) {
  const panel = page.locator("section").filter({ hasText: /Semantic document diff|Compare two versions/i }).first();
  return await panel.getByRole("button", { name: /^Compare$/i }).isEnabled();
}

async function runDesktop(browser, fixture, baseUrl, screenshotDir, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    acceptDownloads: true,
  });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);

  const authSession = await page.request.get(`${baseUrl}/api/auth/session`);
  const profileApi = await page.request.get(`${baseUrl}/api/proxy/api/users/profile`);

  const profileStatus = await gotoAndSettle(page, `${baseUrl}/profile`, new RegExp(escapeRegExp(fixture.user.email)));
  const profileTabs = {};
  for (const tab of [
    { name: "Profile", key: "profile", wait: /Member for|Member since|Connected|QA Browser/i },
    { name: "Credits", key: "credits", wait: /Credits|Balance|History/i },
    { name: "Usage", key: "usage", wait: /Documents|Messages|Usage/i },
    { name: "Account", key: "account", wait: /Export|Danger Zone|Delete account/i },
    { name: "Notifications", key: "notifications", wait: /Notifications|Email me/i },
  ]) {
    await page.getByRole("tab", { name: tab.name }).click();
    if (tab.key !== "profile") {
      await page.waitForURL(new RegExp(`profile\\?tab=${tab.key}`), { timeout: 15000 });
    }
    await waitForVisibleText(page, tab.wait);
    profileTabs[tab.key] = await layoutMetrics(page);
  }

  await page.getByRole("tab", { name: "Account" }).click();
  await waitForVisibleText(page, /Export|Danger Zone|Delete account/i);
  const [exportResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/proxy/api/users/me/export"), { timeout: 30000 }),
    page.getByRole("button", { name: /Download My Data|Export/i }).click(),
  ]);
  const exported = await exportResponseSummary(exportResponse);

  await page.getByRole("button", { name: /Delete account/i }).click();
  const deleteDialog = page.getByRole("dialog");
  await deleteDialog.waitFor({ timeout: 10000 });
  const deleteDialogText = await deleteDialog.innerText();
  const confirmDeleteButton = deleteDialog.getByRole("button", { name: /Delete account/i });
  const deleteEnabledBeforeEmail = await confirmDeleteButton.isEnabled();
  await deleteDialog.getByRole("button", { name: /Cancel/i }).click();
  await deleteDialog.waitFor({ state: "hidden", timeout: 10000 });
  const profileScreenshot = path.join(screenshotDir, "app-profile-desktop-account.png");
  await page.screenshot({ path: profileScreenshot, fullPage: false });

  const billingStatus = await gotoAndSettle(page, `${baseUrl}/billing`, /Billing|Plans and credits/i);
  await waitForVisibleText(page, /Plus|Pro/i);
  const annual = page.getByRole("button", { name: /Annual/i });
  await annual.click();
  await waitForVisibleText(page, /\$7\.99|\$15\.99|20%/i);
  const annualPressed = await annual.getAttribute("aria-pressed");
  const monthly = page.getByRole("button", { name: /Monthly/i });
  await monthly.click();
  await waitForVisibleText(page, /\$9\.99|\$19\.99/i);
  const monthlyPressed = await monthly.getAttribute("aria-pressed");
  await waitForVisibleText(page, /Boost|Power|Ultra|credits/i);
  const billingMetrics = await layoutMetrics(page);
  const billingScreenshot = path.join(screenshotDir, "app-billing-desktop.png");
  await page.screenshot({ path: billingScreenshot, fullPage: false });

  const collectionsStatus = await gotoAndSettle(page, `${baseUrl}/collections`, /Collections|Workspace library/i);
  const createButtons = page.getByRole("button", { name: /Create/i });
  await createButtons.first().click();
  const createDialog = page.getByRole("dialog");
  await createDialog.waitFor({ timeout: 10000 });
  const collectionName = `QA Workflow ${Date.now()}`;
  await createDialog.getByLabel(/Name/i).fill(collectionName);
  await createDialog.getByLabel(/Description/i).fill("Browser QA workspace for app-level smoke testing.");
  await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] input[type="checkbox"]').length >= 2, { timeout: 30000 });
  const checkboxes = createDialog.locator('input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  const selectedText = await createDialog.innerText();
  await Promise.all([
    page.waitForURL(/\/collections\/[0-9a-f-]{36}$/i, { timeout: 30000 }),
    createDialog.getByRole("button", { name: /Create/i }).click(),
  ]);
  const collectionId = collectionIdFromUrl(page.url());
  await waitForVisibleText(page, new RegExp(escapeRegExp(collectionName)));
  await waitForVisibleText(page, /Documents|Sessions|Chat/i);
  const collectionLandingMetrics = await layoutMetrics(page);
  await page.getByRole("button", { name: /Add documents/i }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.waitFor({ timeout: 10000 });
  const addDocsDialogText = await addDialog.innerText();
  await addDialog.getByRole("button", { name: /Cancel/i }).click();
  await addDialog.waitFor({ state: "hidden", timeout: 10000 });

  await page.getByRole("button", { name: /Compare/i }).first().click();
  await waitForVisibleText(page, /Semantic document diff|Compare two versions/i);
  const collectionDiffSelects = await getSelectStats(page);
  const collectionCompareEnabled = await diffPanelCompareEnabled(page);
  const collectionDiffMetrics = await layoutMetrics(page);
  const collectionScreenshot = path.join(screenshotDir, "app-collections-desktop-diff.png");
  await page.screenshot({ path: collectionScreenshot, fullPage: false });

  const standaloneDiffStatus = await gotoAndSettle(page, `${baseUrl}/document-diff`, /Semantic document diff|Compare two versions/i);
  const standaloneDiffSelects = await getSelectStats(page);
  const standaloneCompareEnabled = await diffPanelCompareEnabled(page);
  const standaloneDiffMetrics = await layoutMetrics(page);

  report.desktop = {
    auth_session_status: authSession.status(),
    profile_api_status: profileApi.status(),
    profile: {
      status: profileStatus,
      tabs: profileTabs,
      export_response: exported,
      export_matches_fixture_email: exported.status === 200 && exported.email === fixture.user.email,
      delete_dialog_opened: /delete/i.test(deleteDialogText),
      delete_enabled_before_email: deleteEnabledBeforeEmail,
      screenshot: profileScreenshot,
    },
    billing: {
      status: billingStatus,
      annual_pressed_after_click: annualPressed,
      monthly_pressed_after_click: monthlyPressed,
      metrics: billingMetrics,
      screenshot: billingScreenshot,
    },
    collections: {
      status: collectionsStatus,
      collection_id: collectionId,
      collection_name: collectionName,
      create_modal_selected_text: selectedText.slice(0, 500),
      add_docs_dialog_text: addDocsDialogText.slice(0, 500),
      landing_metrics: collectionLandingMetrics,
      diff_selects: collectionDiffSelects,
      diff_compare_enabled: collectionCompareEnabled,
      diff_metrics: collectionDiffMetrics,
      screenshot: collectionScreenshot,
    },
    document_diff: {
      status: standaloneDiffStatus,
      selects: standaloneDiffSelects,
      compare_enabled: standaloneCompareEnabled,
      metrics: standaloneDiffMetrics,
    },
    console_errors: consoleErrors,
  };

  await context.close();
}

async function runMobile(browser, fixture, baseUrl, screenshotDir, report) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
  });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);
  const collectionId = report.desktop?.collections?.collection_id;

  const profileStatus = await gotoAndSettle(page, `${baseUrl}/profile`, new RegExp(escapeRegExp(fixture.user.email)));
  await page.getByRole("tab", { name: "Credits" }).click();
  await page.waitForURL(/profile\?tab=credits/, { timeout: 15000 });
  await waitForVisibleText(page, /Credits|Balance|History/i);
  const profileMetrics = await layoutMetrics(page);

  const billingStatus = await gotoAndSettle(page, `${baseUrl}/billing`, /Billing|Plans and credits/i);
  await page.getByRole("button", { name: /Annual/i }).click();
  await waitForVisibleText(page, /\$7\.99|\$15\.99|20%/i);
  const billingMetrics = await layoutMetrics(page);

  let collectionMetrics = null;
  let collectionStatus = null;
  if (collectionId) {
    collectionStatus = await gotoAndSettle(page, `${baseUrl}/collections/${collectionId}`, /Collection workspace|Documents|Sessions/i);
    await page.getByRole("button", { name: /Documents/i }).click();
    await waitForVisibleText(page, /semiconductor|license|Documents/i);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await waitForVisibleText(page, /Semantic document diff|Compare two versions/i);
    collectionMetrics = await layoutMetrics(page);
  }

  const diffStatus = await gotoAndSettle(page, `${baseUrl}/document-diff`, /Semantic document diff|Compare two versions/i);
  const diffSelects = await getSelectStats(page);
  const diffCompareEnabled = await diffPanelCompareEnabled(page);
  const diffMetrics = await layoutMetrics(page);
  const screenshot = path.join(screenshotDir, "app-mobile-diff.png");
  await page.screenshot({ path: screenshot, fullPage: false });

  report.mobile = {
    profile: { status: profileStatus, metrics: profileMetrics },
    billing: { status: billingStatus, metrics: billingMetrics },
    collections: { status: collectionStatus, metrics: collectionMetrics },
    document_diff: {
      status: diffStatus,
      selects: diffSelects,
      compare_enabled: diffCompareEnabled,
      metrics: diffMetrics,
      screenshot,
    },
    console_errors: consoleErrors,
  };

  await context.close();
}

function noOverflow(metrics) {
  return metrics && !metrics.overflowX && (!metrics.clippedInteractive || metrics.clippedInteractive.length === 0);
}

function everyProfileTabOk(tabs) {
  return Object.values(tabs || {}).every(noOverflow);
}

function hasTwoSelectOptions(selects) {
  return Array.isArray(selects)
    && selects.length >= 2
    && selects.every((select) => Array.isArray(select.options) && select.options.length >= 2);
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-app-workflows-fixture-2026-05-10.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-app-workflows-ux-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    user_id: fixture.user.id,
    document_ids: fixture.document_ids,
  };

  const browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP host.docker.internal 127.0.0.1"],
  });
  try {
    await runDesktop(browser, fixture, baseUrl, screenshotDir, report);
    await runMobile(browser, fixture, baseUrl, screenshotDir, report);
  } finally {
    await browser.close();
  }

  const desktopOk =
    report.desktop.auth_session_status === 200 &&
    report.desktop.profile_api_status === 200 &&
    report.desktop.profile.status === 200 &&
    everyProfileTabOk(report.desktop.profile.tabs) &&
    report.desktop.profile.export_response.status === 200 &&
    /doctalk-data-export\.json/i.test(report.desktop.profile.export_response.content_disposition || "") &&
    report.desktop.profile.delete_dialog_opened &&
    report.desktop.profile.delete_enabled_before_email === false &&
    report.desktop.billing.status === 200 &&
    report.desktop.billing.annual_pressed_after_click === "true" &&
    report.desktop.billing.monthly_pressed_after_click === "true" &&
    noOverflow(report.desktop.billing.metrics) &&
    report.desktop.collections.status === 200 &&
    hasTwoSelectOptions(report.desktop.collections.diff_selects) &&
    report.desktop.collections.diff_compare_enabled &&
    noOverflow(report.desktop.collections.landing_metrics) &&
    noOverflow(report.desktop.collections.diff_metrics) &&
    report.desktop.document_diff.status === 200 &&
    hasTwoSelectOptions(report.desktop.document_diff.selects) &&
    report.desktop.document_diff.compare_enabled &&
    noOverflow(report.desktop.document_diff.metrics) &&
    report.desktop.console_errors.length === 0;

  const mobileOk =
    report.mobile.profile.status === 200 &&
    !report.mobile.profile.metrics.overflowX &&
    report.mobile.billing.status === 200 &&
    noOverflow(report.mobile.billing.metrics) &&
    (!report.mobile.collections.metrics || noOverflow(report.mobile.collections.metrics)) &&
    report.mobile.document_diff.status === 200 &&
    hasTwoSelectOptions(report.mobile.document_diff.selects) &&
    report.mobile.document_diff.compare_enabled &&
    noOverflow(report.mobile.document_diff.metrics) &&
    report.mobile.console_errors.length === 0;

  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
    collection_id: report.desktop.collections.collection_id,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: browser app-workflow UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser app-workflow UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
