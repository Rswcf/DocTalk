#!/usr/bin/env node
/* Browser UX check for Free-plan documents-per-collection limit. */

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

async function getCollection(page, baseUrl, collectionId) {
  const response = await page.request.get(`${baseUrl}/api/proxy/api/collections/${collectionId}`);
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
        .filter((link) => /upgrade/i.test(link.text) || /collection_doc_limit/.test(link.href)),
    };
  });
}

async function dismissCookieBanner(page) {
  const bannerButton = page.getByRole("button", { name: /Accept|Decline/i }).first();
  if (await bannerButton.isVisible().catch(() => false)) {
    await bannerButton.click();
  }
}

async function openAddDocuments(page, name) {
  if (name === "mobile") {
    await page.getByRole("button", { name: /Documents/i }).click();
  }
  await page.getByRole("button", { name: /Add documents/i }).click();
  await page.getByRole("heading", { name: /Add documents/i }).waitFor({ timeout: 30000 });
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

  const collectionId = scenario.collection.id;
  await page.goto(`${baseUrl}/collections/${collectionId}`, { waitUntil: "networkidle", timeout: 60000 });
  await dismissCookieBanner(page);
  await page.getByRole("heading", { name: new RegExp(scenario.collection.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().waitFor({ timeout: 60000 });
  const before = await getCollection(page, baseUrl, collectionId);
  const beforeState = await state(page);

  await openAddDocuments(page, name);
  await page.getByRole("button", { name: new RegExp(scenario.extra_document.filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await page.waitForTimeout(1200);

  const after = await getCollection(page, baseUrl, collectionId);
  const afterState = await state(page);
  const screenshot = path.join(screenshotDir, `collection-doc-limit-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  await context.close();
  return {
    user_id: scenario.user.id,
    collection_id: collectionId,
    extra_document_id: scenario.extra_document.id,
    expected_document_count: scenario.max_docs_per_collection,
    api_before: before,
    before: beforeState,
    api_after: after,
    after: afterState,
    screenshot,
    console_errors: consoleErrors,
    ignored_console_errors: ignoredConsoleErrors,
  };
}

function scenarioOk(result) {
  const beforeDocs = Array.isArray(result.api_before.body.documents) ? result.api_before.body.documents : [];
  const afterDocs = Array.isArray(result.api_after.body.documents) ? result.api_after.body.documents : [];
  const hasLimitCopy = /Too many documents|Your plan allows up to 3 documents per collection/i.test(result.after.alertText);
  const hasUpgrade = result.after.upgradeLinks.some((link) => /collection_doc_limit/.test(link.href) && /billing/.test(link.href));
  return result.api_before.status === 200
    && result.api_after.status === 200
    && beforeDocs.length === result.expected_document_count
    && afterDocs.length === result.expected_document_count
    && !afterDocs.map((doc) => doc.id).includes(result.extra_document_id)
    && hasLimitCopy
    && hasUpgrade
    && result.after.modalOpen
    && !result.before.overflowX
    && !result.after.overflowX
    && result.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-collection-doc-limit-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-collection-doc-limit-ux-2026-05-11.json"));
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
    console.error(`FAIL: browser collection-doc-limit UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser collection-doc-limit UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
