#!/usr/bin/env node
/* Browser UX check for non-PDF TextViewer citation jump behavior. */

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

async function fetchMessages(page, baseUrl, sessionId) {
  const res = await page.request.get(`${baseUrl}/api/proxy/api/sessions/${sessionId}/messages`);
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = { text: await res.text() };
  }
  return { status: res.status(), body };
}

async function metrics(page, expectedHighlight, filename) {
  return await page.evaluate(({ expected, expectedFilename }) => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const sourceButtons = [...document.querySelectorAll(".dt-source-index")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { text: el.textContent || "", x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      });
    const highlights = [...document.querySelectorAll("span.bg-amber-200")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return { text, x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      });
    const activeTab = [...document.querySelectorAll("button")]
      .filter(visible)
      .find((el) => /Document|文档|Dokument|Documento|ドキュメント|문서/i.test(el.textContent || "")
        && /text-blue/.test(el.className || ""));
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      bodyTextLength: document.body.innerText.length,
      sourceButtons,
      highlights,
      highlightContainsExpected: highlights.some((item) => expected.includes(item.text) || item.text.includes(expected.slice(0, 50))),
      visibleDocumentName: document.body.innerText.includes(expectedFilename),
      documentTabSelected: Boolean(activeTab),
    };
  }, { expected: expectedHighlight, expectedFilename: filename });
}

async function runCaseViewport(browser, fixture, testCase, baseUrl, screenshotDir, viewportName, viewportOptions) {
  const context = await browser.newContext({ ...viewportOptions });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(`${baseUrl}/d/${testCase.document_id}`, { waitUntil: "domcontentloaded" });
  await page.locator(".dt-composer:visible").first().waitFor({ timeout: 45000 });
  await page.locator(".dt-source-index:visible").first().waitFor({ timeout: 45000 });

  const messages = await fetchMessages(page, baseUrl, testCase.session_id);
  const assistantMessages = Array.isArray(messages.body?.messages)
    ? messages.body.messages.filter((item) => item.role === "assistant")
    : [];
  const latestAssistant = assistantMessages[assistantMessages.length - 1] || {};
  const citationCount = Array.isArray(latestAssistant.citations) ? latestAssistant.citations.length : 0;
  const before = await metrics(page, testCase.expected_highlight, testCase.filename);

  await page.locator(".dt-source-index:visible").first().click();
  await page.locator("span.bg-amber-200:visible").first().waitFor({ timeout: 30000 });
  const after = await metrics(page, testCase.expected_highlight, testCase.filename);
  const screenshot = path.join(screenshotDir, `nonpdf-citation-${testCase.id}-${viewportName}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  await context.close();
  return {
    case_id: testCase.id,
    file_type: testCase.file_type,
    viewport: viewportName,
    url: page.url(),
    messages_status: messages.status,
    assistant_message_count: assistantMessages.length,
    latest_assistant_chars: String(latestAssistant.content || "").length,
    latest_assistant_citation_count: citationCount,
    before,
    after,
    screenshot,
    console_errors: consoleErrors,
  };
}

function ok(result, requireMobileTab) {
  return result.messages_status === 200
    && result.latest_assistant_citation_count > 0
    && result.before.sourceButtons.length > 0
    && result.after.highlights.length > 0
    && result.after.highlightContainsExpected
    && result.after.visibleDocumentName
    && (!requireMobileTab || result.after.documentTabSelected)
    && !result.after.overflowX
    && result.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-nonpdf-citation-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-nonpdf-citation-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (!fixture.user || !Array.isArray(fixture.cases) || fixture.cases.length === 0) {
    throw new Error("Fixture must include user and cases");
  }

  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    cases: [],
  };
  try {
    for (const testCase of fixture.cases) {
      const desktop = await runCaseViewport(
        browser,
        fixture,
        testCase,
        baseUrl,
        screenshotDir,
        "desktop",
        { viewport: { width: 1440, height: 900 } },
      );
      const mobile = await runCaseViewport(
        browser,
        fixture,
        testCase,
        baseUrl,
        screenshotDir,
        "mobile",
        { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      );
      report.cases.push({
        id: testCase.id,
        file_type: testCase.file_type,
        document_id: testCase.document_id,
        session_id: testCase.session_id,
        desktop,
        mobile,
        assertions: {
          desktop_ok: ok(desktop, false),
          mobile_ok: ok(mobile, true),
        },
      });
    }
  } finally {
    await browser.close();
  }

  const failures = report.cases.filter((item) => !item.assertions.desktop_ok || !item.assertions.mobile_ok);
  report.result = failures.length === 0 ? "pass" : "fail";
  report.summary = {
    total_cases: report.cases.length,
    failed_cases: failures.map((item) => item.id),
    total_console_errors: report.cases.reduce(
      (sum, item) => sum + item.desktop.console_errors.length + item.mobile.console_errors.length,
      0,
    ),
  };

  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== "pass") {
    console.error(`FAIL: browser non-PDF citation UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser non-PDF citation UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
