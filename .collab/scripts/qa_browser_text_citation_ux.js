#!/usr/bin/env node
/* Browser UX check for URL/TextViewer citation jump and highlight behavior. */

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

async function metrics(page, expectedHighlight) {
  return await page.evaluate((expected) => {
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
      visibleOriginalLink: [...document.querySelectorAll("a[href='https://example.com/']")].some(visible),
      visibleExampleTitle: /Example Domain QA Source/i.test(document.body.innerText),
      documentTabSelected: Boolean(activeTab),
    };
  }, expectedHighlight);
}

async function runViewport(browser, fixture, baseUrl, screenshotDir, name, viewportOptions) {
  const context = await browser.newContext({ ...viewportOptions });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(`${baseUrl}/d/${fixture.document_id}`, { waitUntil: "domcontentloaded" });
  await page.locator(".dt-composer:visible").first().waitFor({ timeout: 45000 });
  await page.locator(".dt-source-index:visible").first().waitFor({ timeout: 45000 });

  const messages = await fetchMessages(page, baseUrl, fixture.session_id);
  const assistantMessages = Array.isArray(messages.body?.messages)
    ? messages.body.messages.filter((item) => item.role === "assistant")
    : [];
  const latestAssistant = assistantMessages[assistantMessages.length - 1] || {};
  const citationCount = Array.isArray(latestAssistant.citations) ? latestAssistant.citations.length : 0;
  const before = await metrics(page, fixture.expected_highlight);

  await page.locator(".dt-source-index:visible").first().click();
  await page.locator("span.bg-amber-200:visible").first().waitFor({ timeout: 30000 });
  const after = await metrics(page, fixture.expected_highlight);
  const screenshot = path.join(screenshotDir, `text-citation-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  await context.close();
  return {
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

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-text-citation-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-text-citation-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (!fixture.user || !fixture.document_id || !fixture.session_id || !fixture.expected_highlight) {
    throw new Error("Fixture must include user, document_id, session_id, and expected_highlight");
  }

  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    document_id: fixture.document_id,
    session_id: fixture.session_id,
  };
  try {
    report.desktop = await runViewport(
      browser,
      fixture,
      baseUrl,
      screenshotDir,
      "desktop",
      { viewport: { width: 1440, height: 900 } },
    );
    report.mobile = await runViewport(
      browser,
      fixture,
      baseUrl,
      screenshotDir,
      "mobile",
      { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    );
  } finally {
    await browser.close();
  }

  const desktopOk =
    report.desktop.messages_status === 200 &&
    report.desktop.latest_assistant_citation_count > 0 &&
    report.desktop.before.sourceButtons.length > 0 &&
    report.desktop.after.highlights.length > 0 &&
    report.desktop.after.highlightContainsExpected &&
    report.desktop.after.visibleOriginalLink &&
    report.desktop.after.visibleExampleTitle &&
    !report.desktop.after.overflowX &&
    report.desktop.console_errors.length === 0;
  const mobileOk =
    report.mobile.messages_status === 200 &&
    report.mobile.latest_assistant_citation_count > 0 &&
    report.mobile.before.sourceButtons.length > 0 &&
    report.mobile.after.highlights.length > 0 &&
    report.mobile.after.highlightContainsExpected &&
    report.mobile.after.visibleOriginalLink &&
    report.mobile.after.visibleExampleTitle &&
    report.mobile.after.documentTabSelected &&
    !report.mobile.after.overflowX &&
    report.mobile.console_errors.length === 0;

  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    desktop_citations: report.desktop.latest_assistant_citation_count,
    mobile_citations: report.mobile.latest_assistant_citation_count,
    desktop_highlights: report.desktop.after.highlights.length,
    mobile_highlights: report.mobile.after.highlights.length,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: browser text citation UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser text citation UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
