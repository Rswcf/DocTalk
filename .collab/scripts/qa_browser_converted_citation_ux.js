#!/usr/bin/env node
/* Browser UX check for converted DOCX/PPTX slide-view citation jump behavior. */

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

async function metrics(page, testCase) {
  return await page.evaluate(({ expected, expectedFilename, targetPage }) => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const inViewport = (rect) => (
      rect.bottom > 0
      && rect.top < window.innerHeight
      && rect.right > 0
      && rect.left < window.innerWidth
    );
    const sourceButtons = [...document.querySelectorAll(".dt-source-index")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { text: el.textContent || "", x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      });
    const pdfHighlights = [...document.querySelectorAll(".textLayer mark.pdf-highlight, .citation-overlay")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return { text, x: rect.x, y: rect.y, w: rect.width, h: rect.height, inViewport: inViewport(rect) };
      });
    const textHighlights = [...document.querySelectorAll("span.bg-amber-200")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return { text, x: rect.x, y: rect.y, w: rect.width, h: rect.height, inViewport: inViewport(rect) };
      });
    const buttons = [...document.querySelectorAll("button")].filter(visible);
    const slideButton = buttons.find((el) => /Slides|幻灯|Folie|Diapositiva|スライド|슬라이드/i.test(el.textContent || ""));
    const textButton = buttons.find((el) => /Text|文本|Texte|Texto|テキスト|텍스트/i.test(el.textContent || ""));
    const activeMobileDocumentTab = buttons.find((el) => /Document|文档|Dokument|Documento|ドキュメント|문서/i.test(el.textContent || "")
      && /text-blue/.test(el.className || ""));
    const pageNode = document.querySelector(`.dt-document-stage [data-page-number="${targetPage}"]`);
    const pageVisible = Boolean(pageNode && visible(pageNode));
    const expectedWords = expected
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4);
    const highlightedText = pdfHighlights.concat(textHighlights).map((item) => item.text).join(" ").toLowerCase();
    const matchedWords = expectedWords.filter((word) => highlightedText.includes(word));

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      bodyTextLength: document.body.innerText.length,
      sourceButtons,
      pdfHighlights,
      textHighlights,
      expectedWordCount: expectedWords.length,
      matchedExpectedWords: [...new Set(matchedWords)],
      visibleDocumentName: document.body.innerText.includes(expectedFilename),
      viewToggleVisible: Boolean(slideButton && textButton),
      slideSelected: Boolean(slideButton && /bg-zinc-900|dark:bg-zinc-50/.test(slideButton.className || "")),
      textSelected: Boolean(textButton && /bg-zinc-900|dark:bg-zinc-50/.test(textButton.className || "")),
      documentTabSelected: Boolean(activeMobileDocumentTab),
      targetPageVisible: pageVisible,
    };
  }, {
    expected: testCase.expected_highlight,
    expectedFilename: testCase.filename,
    targetPage: testCase.target_page,
  });
}

async function clickTextToggle(page) {
  const textToggle = page.locator(".dt-view-toggle:visible button").filter({ hasText: /Text|文本|Texte|Texto|テキスト|텍스트/i }).first();
  await textToggle.click();
  await page.locator("span.bg-amber-200:visible").first().waitFor({ timeout: 30000 });
}

async function runCaseViewport(browser, fixture, testCase, baseUrl, screenshotDir, viewportName, viewportOptions) {
  const context = await browser.newContext({ ...viewportOptions });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  const ignoredConsoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/AbortException: TextLayer task cancelled/i.test(text)) {
      ignoredConsoleErrors.push(text);
      return;
    }
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(`${baseUrl}/d/${testCase.document_id}`, { waitUntil: "domcontentloaded" });
  await page.locator(".dt-composer:visible").first().waitFor({ timeout: 45000 });
  await page.locator(".dt-source-index:visible").first().waitFor({ timeout: 45000 });
  if (viewportName !== "mobile") {
    await page.locator(".dt-view-toggle:visible").first().waitFor({ timeout: 45000 });
  }

  const messages = await fetchMessages(page, baseUrl, testCase.session_id);
  const assistantMessages = Array.isArray(messages.body?.messages)
    ? messages.body.messages.filter((item) => item.role === "assistant")
    : [];
  const latestAssistant = assistantMessages[assistantMessages.length - 1] || {};
  const citationCount = Array.isArray(latestAssistant.citations) ? latestAssistant.citations.length : 0;
  const before = await metrics(page, testCase);

  await page.locator(".dt-source-index:visible").first().click();
  await page.locator(".dt-view-toggle:visible").first().waitFor({ timeout: 45000 });
  await page.locator(".textLayer mark.pdf-highlight:visible, .citation-overlay:visible").first().waitFor({ timeout: 45000 });
  await page.waitForFunction(() => {
    return [...document.querySelectorAll(".textLayer mark.pdf-highlight, .citation-overlay")]
      .some((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0
          && rect.height > 0
          && style.display !== "none"
          && style.visibility !== "hidden"
          && rect.bottom > 0
          && rect.top < window.innerHeight
          && rect.right > 0
          && rect.left < window.innerWidth;
      });
  }, null, { timeout: 45000 });
  const afterSlide = await metrics(page, testCase);
  const slideScreenshot = path.join(screenshotDir, `converted-citation-${testCase.id}-${viewportName}-slide.png`);
  await page.screenshot({ path: slideScreenshot, fullPage: false });

  await clickTextToggle(page);
  const afterText = await metrics(page, testCase);
  const textScreenshot = path.join(screenshotDir, `converted-citation-${testCase.id}-${viewportName}-text.png`);
  await page.screenshot({ path: textScreenshot, fullPage: false });

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
    after_slide: afterSlide,
    after_text: afterText,
    screenshots: {
      slide: slideScreenshot,
      text: textScreenshot,
    },
    console_errors: consoleErrors,
    ignored_console_errors: ignoredConsoleErrors,
  };
}

function enoughWords(metric, minimum = 5) {
  return metric.matchedExpectedWords.length >= Math.min(minimum, metric.expectedWordCount);
}

function ok(result, requireMobileTab) {
  return result.messages_status === 200
    && result.latest_assistant_citation_count > 0
    && result.before.sourceButtons.length > 0
    && (!requireMobileTab || !result.before.documentTabSelected)
    && (requireMobileTab || (result.before.viewToggleVisible && result.before.slideSelected))
    && result.after_slide.pdfHighlights.length > 0
    && result.after_slide.pdfHighlights.some((item) => item.inViewport)
    && enoughWords(result.after_slide)
    && result.after_slide.visibleDocumentName
    && result.after_slide.viewToggleVisible
    && result.after_slide.slideSelected
    && (!requireMobileTab || result.after_slide.documentTabSelected)
    && !result.after_slide.overflowX
    && result.after_text.textHighlights.length > 0
    && result.after_text.textHighlights.some((item) => item.inViewport)
    && enoughWords(result.after_text)
    && result.after_text.textSelected
    && !result.after_text.overflowX
    && result.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-converted-citation-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-converted-citation-ux-2026-05-11.json"));
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
    ignored_text_layer_cancellations: report.cases.reduce(
      (sum, item) => sum + item.desktop.ignored_console_errors.length + item.mobile.ignored_console_errors.length,
      0,
    ),
  };

  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== "pass") {
    console.error(`FAIL: browser converted citation UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser converted citation UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
