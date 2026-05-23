#!/usr/bin/env node
/* Browser UX check for the ExtractionPanel AI table rebuild action. */

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
    domain: new URL(baseUrl).hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  };
}

function tablePayload(fixture, rebuilt) {
  return {
    id: fixture.table_id,
    document_id: fixture.document_id,
    page: 1,
    page_end: null,
    table_index: 0,
    rows: rebuilt
      ? [
          ["Metric", "2026E", "2027E"],
          ["Revenue", "42", "51"],
          ["Churn", "3%", "2%"],
        ]
      : [
          ["Metric 2026E 2027E"],
          ["Revenue 42 51"],
          ["Churn 3% 2%"],
        ],
    confidence: rebuilt ? 0.91 : 0.82,
    method: rebuilt ? "llm_reconstructed" : "pymupdf",
    metadata_json: rebuilt ? { ai_reconstructed: true, model: "browser-mocked-live-job" } : { provider: "pymupdf" },
    warnings: rebuilt ? ["Browser QA warning: verify critical numbers against source."] : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function visibleText(page, pattern) {
  return await page.evaluate((source) => {
    const regex = new RegExp(source, "i");
    return regex.test(document.body.innerText || "");
  }, pattern.source);
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-structured-workflows-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-table-ai-rebuild-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const jobId = `qa-table-rebuild-${Date.now()}`;
  let postSeen = false;
  let pollCount = 0;
  let listCount = 0;
  let rebuilt = false;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.route(`**/api/proxy/api/documents/${fixture.document_id}/tables`, async (route) => {
    listCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([tablePayload(fixture, rebuilt)]),
    });
  });
  await page.route(`**/api/proxy/api/document-tables/${fixture.table_id}/reconstruct`, async (route) => {
    postSeen = true;
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        id: jobId,
        document_id: fixture.document_id,
        collection_id: null,
        job_type: "table_reconstruct",
        status: "queued",
        input_scope: { document_id: fixture.document_id, table_id: fixture.table_id },
        cost_credits: 0,
        error_code: null,
        error_message: null,
        metadata_json: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
      }),
    });
  });
  await page.route(`**/api/proxy/api/document-table-scans/${jobId}`, async (route) => {
    pollCount += 1;
    rebuilt = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: jobId,
        document_id: fixture.document_id,
        collection_id: null,
        job_type: "table_reconstruct",
        status: "succeeded",
        input_scope: { document_id: fixture.document_id, table_id: fixture.table_id },
        cost_credits: 0,
        error_code: null,
        error_message: null,
        metadata_json: { method: "llm_reconstructed" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }),
    });
  });

  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    document_id: fixture.document_id,
    table_id: fixture.table_id,
  };

  try {
    await page.goto(`${baseUrl}/d/${fixture.document_id}`, { waitUntil: "domcontentloaded" });
    await page.locator(".dt-composer:visible").first().waitFor({ timeout: 45000 });
    await page.getByRole("button", { name: "AI rebuild" }).first().waitFor({ timeout: 30000 });
    const beforeBasicWarning = await visibleText(page, /Basic extraction can misalign/i);
    await page.getByRole("button", { name: "AI rebuild" }).first().click();
    await page.getByText("AI rebuilt").first().waitFor({ timeout: 15000 });
    const summaryVisible = await visibleText(page, /AI table rebuild complete/i);
    const afterAiWarning = await visibleText(page, /AI rebuilt this table/i);
    const warningVisible = await visibleText(page, /Browser QA warning/i);
    const screenshot = path.join(screenshotDir, "table-ai-rebuild-desktop.png");
    await page.screenshot({ path: screenshot, fullPage: false });
    Object.assign(report, {
      result: postSeen && pollCount > 0 && summaryVisible && afterAiWarning && warningVisible && consoleErrors.length === 0
        ? "pass"
        : "fail",
      post_seen: postSeen,
      poll_count: pollCount,
      list_count: listCount,
      summary_visible: summaryVisible,
      before_basic_warning: beforeBasicWarning,
      after_ai_warning: afterAiWarning,
      warning_visible: warningVisible,
      console_errors: consoleErrors,
      screenshot,
    });
  } catch (err) {
    Object.assign(report, {
      result: "fail",
      error: err instanceof Error ? err.message : String(err),
      post_seen: postSeen,
      poll_count: pollCount,
      list_count: listCount,
      body_text: await page.locator("body").innerText({ timeout: 1000 }).catch(() => ""),
      console_errors: consoleErrors,
    });
  } finally {
    await context.close();
    await browser.close();
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`BROWSER_TABLE_AI_REBUILD result=${report.result} post=${report.post_seen} polls=${report.poll_count}`);
  if (report.error) console.log(`error=${report.error}`);
  process.exit(report.result === "pass" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
