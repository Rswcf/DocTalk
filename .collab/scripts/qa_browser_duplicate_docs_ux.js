#!/usr/bin/env node
/* Browser UX check for duplicate filenames and deleted-document error state. */

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

async function waitForDashboard(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('input[aria-label="Upload document"]').waitFor({ state: "attached", timeout: 60000 });
  await page.getByRole("link", { name: /Open/i }).first().waitFor({ timeout: 60000 });
}

async function dashboardState(page, scenario) {
  return await page.evaluate((input) => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const anchors = [...document.querySelectorAll('a[href^="/d/"]')]
      .filter(visible)
      .map((el) => ({ text: (el.textContent || "").trim(), href: el.getAttribute("href") || "" }));
    const duplicateCardLinks = anchors.filter(
      (link) => link.text.includes(input.duplicateFilename) && !/^Open$/i.test(link.text),
    );
    return {
      url: window.location.href,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      body: document.body.innerText,
      anchors,
      duplicate_card_links: duplicateCardLinks,
      fixture_link_counts: Object.fromEntries(
        input.docIds.map((id) => [id, anchors.filter((link) => link.href === `/d/${id}`).length]),
      ),
    };
  }, {
    duplicateFilename: scenario.duplicate_filename,
    docIds: scenario.documents.map((doc) => doc.id),
  });
}

async function readerErrorState(page) {
  await page.waitForFunction(() => /Document not found|doesn.t exist|isn.t yours/i.test(document.body.innerText), null, {
    timeout: 30000,
  });
  return await page.evaluate(() => ({
    url: window.location.href,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    body: document.body.innerText,
    backHomeVisible: [...document.querySelectorAll("button, a")]
      .some((el) => /Back home|Back Home|Home/i.test(el.textContent || "") && el.getBoundingClientRect().width > 0),
  }));
}

async function getApiDocs(page, baseUrl) {
  const response = await page.request.get(`${baseUrl}/api/proxy/api/documents`);
  return {
    status: response.status(),
    body: await response.json().catch(async () => ({ text: await response.text() })),
  };
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
    if (/Failed to load resource: the server responded with a status of 404/i.test(text)) {
      ignoredConsoleErrors.push(text);
      return;
    }
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await waitForDashboard(page, baseUrl);
  const apiBefore = await getApiDocs(page, baseUrl);
  const before = await dashboardState(page, scenario);
  const beforeScreenshot = path.join(screenshotDir, `duplicate-docs-${name}-before-delete.png`);
  await page.screenshot({ path: beforeScreenshot, fullPage: false });

  const targetId = scenario.delete_target_id;
  const survivorId = scenario.survivor_id;
  const targetCard = page.locator(`a[href="/d/${targetId}"]`).first().locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
  await targetCard.getByRole("button", { name: /Delete document/i }).click();
  await targetCard.getByRole("button", { name: /^Yes$/i }).click();
  await page.waitForFunction((id) => !document.querySelector(`a[href="/d/${id}"]`), targetId, { timeout: 30000 });

  const apiAfter = await getApiDocs(page, baseUrl);
  const afterDelete = await dashboardState(page, scenario);
  const afterScreenshot = path.join(screenshotDir, `duplicate-docs-${name}-after-delete.png`);
  await page.screenshot({ path: afterScreenshot, fullPage: false });

  await page.goto(`${baseUrl}/d/${targetId}`, { waitUntil: "domcontentloaded" });
  const deletedReader = await readerErrorState(page);
  const errorScreenshot = path.join(screenshotDir, `duplicate-docs-${name}-deleted-reader.png`);
  await page.screenshot({ path: errorScreenshot, fullPage: false });

  await context.close();
  return {
    user_id: scenario.user.id,
    duplicate_filename: scenario.duplicate_filename,
    delete_target_id: targetId,
    survivor_id: survivorId,
    api_before: apiBefore,
    before,
    api_after: apiAfter,
    after_delete: afterDelete,
    deleted_reader: deletedReader,
    screenshots: {
      before: beforeScreenshot,
      after_delete: afterScreenshot,
      deleted_reader: errorScreenshot,
    },
    console_errors: consoleErrors,
    ignored_console_errors: ignoredConsoleErrors,
  };
}

function scenarioOk(result) {
  const beforeDocs = Array.isArray(result.api_before.body) ? result.api_before.body : [];
  const afterDocs = Array.isArray(result.api_after.body) ? result.api_after.body : [];
  const beforeDuplicateDocs = beforeDocs.filter((doc) => doc.filename === result.duplicate_filename);
  const afterDuplicateDocs = afterDocs.filter((doc) => doc.filename === result.duplicate_filename);
  return result.api_before.status === 200
    && result.api_after.status === 200
    && beforeDuplicateDocs.length === 2
    && afterDuplicateDocs.length === 1
    && beforeDuplicateDocs.map((doc) => doc.id).includes(result.delete_target_id)
    && beforeDuplicateDocs.map((doc) => doc.id).includes(result.survivor_id)
    && !afterDuplicateDocs.map((doc) => doc.id).includes(result.delete_target_id)
    && afterDuplicateDocs.map((doc) => doc.id).includes(result.survivor_id)
    && result.before.duplicate_card_links.length === 2
    && new Set(result.before.duplicate_card_links.map((link) => link.href)).size === 2
    && result.before.fixture_link_counts[result.delete_target_id] >= 1
    && result.before.fixture_link_counts[result.survivor_id] >= 1
    && result.after_delete.fixture_link_counts[result.delete_target_id] === 0
    && result.after_delete.fixture_link_counts[result.survivor_id] >= 1
    && /Document not found/i.test(result.deleted_reader.body)
    && result.deleted_reader.backHomeVisible
    && !result.before.overflowX
    && !result.after_delete.overflowX
    && !result.deleted_reader.overflowX
    && result.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-duplicate-docs-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-duplicate-docs-ux-2026-05-11.json"));
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
    ignored_expected_404_console_errors:
      report.desktop.ignored_console_errors.length + report.mobile.ignored_console_errors.length,
  };
  report.result = report.summary.desktop_ok && report.summary.mobile_ok ? "pass" : "fail";
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== "pass") {
    console.error(`FAIL: duplicate-doc browser UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: duplicate-doc browser UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
