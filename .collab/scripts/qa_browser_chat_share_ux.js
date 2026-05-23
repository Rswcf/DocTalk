#!/usr/bin/env node
/* Browser UX checks for authenticated ChatPanel copy and share flows. */

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

async function clipboardWrites(page) {
  return await page.evaluate(() => globalThis.__qaClipboardWrites || []);
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
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -2 || item.right > window.innerWidth + 2)
      .slice(0, 10);
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clippedInteractive,
    };
  });
}

function sharedPath(url) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.hash || ""}`;
}

async function apiSharedStatus(page, baseUrl, copiedUrl) {
  const parsed = new URL(copiedUrl);
  const res = await page.request.get(`${baseUrl}/api/proxy/api/shared${parsed.pathname.replace(/^\/shared/, "")}`);
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = { text: await res.text() };
  }
  return {
    status: res.status(),
    message_count: Array.isArray(body.messages) ? body.messages.length : null,
    session_title: body.session_title || null,
  };
}

async function runViewport(browser, fixture, baseUrl, screenshotDir, report, mode) {
  const contextOptions = mode === "mobile"
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } };
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    globalThis.__qaClipboardWrites = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          globalThis.__qaClipboardWrites.push(String(text));
        },
        readText: async () => globalThis.__qaClipboardWrites.at(-1) || "",
      },
    });
  });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);

  await page.goto(`${baseUrl}/d/${fixture.document_id}`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /semiconductor reading list/);
  await waitForVisibleText(page, /related market notes/);

  const authSession = await page.request.get(`${baseUrl}/api/auth/session`);
  const profile = await page.request.get(`${baseUrl}/api/proxy/api/users/profile`);
  const copyButton = page.getByRole("button", { name: /^Copy$/i }).first();
  await copyButton.click();
  await page.waitForFunction(() => (globalThis.__qaClipboardWrites || []).length >= 1);
  const writesAfterCopy = await clipboardWrites(page);

  await page.getByRole("button", { name: /Share this answer/i }).first().click();
  await waitForVisibleText(page, /Answer link copied to clipboard/);
  await page.waitForFunction(() => (globalThis.__qaClipboardWrites || []).length >= 2);
  const writesAfterAnswerShare = await clipboardWrites(page);
  const answerShareUrl = writesAfterAnswerShare.at(-1);
  const answerPublic = await apiSharedStatus(page, baseUrl, answerShareUrl);

  await page.getByRole("button", { name: /Share conversation/i }).first().click();
  await waitForVisibleText(page, /Link copied to clipboard/);
  await page.waitForFunction(() => (globalThis.__qaClipboardWrites || []).length >= 3);
  const writesAfterConversationShare = await clipboardWrites(page);
  const conversationShareUrl = writesAfterConversationShare.at(-1);
  const conversationPublic = await apiSharedStatus(page, baseUrl, conversationShareUrl);

  const answerPath = sharedPath(answerShareUrl);
  const sharedPage = await context.newPage();
  const sharedConsoleErrors = attachConsole(sharedPage);
  const sharedResponse = await sharedPage.goto(`${baseUrl}${answerPath}`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(sharedPage, /QA chat share browser session/);
  const sharedTarget = await sharedPage.evaluate((anchor) => ({
    hash: window.location.hash,
    target_id: document.querySelector(":target")?.id || null,
    expected_exists: Boolean(document.getElementById(anchor)),
  }), fixture.assistant_anchor);

  const metrics = await layoutMetrics(page);
  const sharedMetrics = await layoutMetrics(sharedPage);
  const screenshot = path.join(screenshotDir, `chat-share-${mode}.png`);
  const sharedScreenshot = path.join(screenshotDir, `chat-share-public-${mode}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await sharedPage.screenshot({ path: sharedScreenshot, fullPage: false });

  report[mode] = {
    url: page.url(),
    auth_session_status: authSession.status(),
    profile_status: profile.status(),
    copy_write: writesAfterCopy.at(-1) || null,
    answer_share_url: answerShareUrl,
    answer_share_origin: new URL(answerShareUrl).origin,
    answer_share_path: answerPath,
    answer_public: answerPublic,
    conversation_share_url: conversationShareUrl,
    conversation_share_origin: new URL(conversationShareUrl).origin,
    conversation_share_path: sharedPath(conversationShareUrl),
    conversation_public: conversationPublic,
    shared_page_status: sharedResponse ? sharedResponse.status() : null,
    shared_target: sharedTarget,
    metrics,
    shared_metrics: sharedMetrics,
    screenshot,
    shared_screenshot: sharedScreenshot,
    console_errors: consoleErrors,
    shared_console_errors: sharedConsoleErrors,
  };

  await context.close();
}

function noOverflow(metrics) {
  return metrics && !metrics.overflowX && (!metrics.clippedInteractive || metrics.clippedInteractive.length === 0);
}

function validViewport(result, fixture) {
  return result.auth_session_status === 200
    && result.profile_status === 200
    && typeof result.copy_write === "string"
    && result.copy_write.includes("semiconductor reading list")
    && typeof result.answer_share_url === "string"
    && result.answer_share_url.startsWith(fixture.frontend_url)
    && result.answer_share_path.startsWith("/shared/")
    && result.answer_share_path.endsWith(`#${fixture.assistant_anchor}`)
    && result.answer_public.status === 200
    && result.answer_public.message_count === 2
    && typeof result.conversation_share_url === "string"
    && result.conversation_share_url.startsWith(fixture.frontend_url)
    && /^\/shared\/[0-9a-f-]{36}$/i.test(result.conversation_share_path)
    && result.conversation_public.status === 200
    && result.conversation_public.message_count === 2
    && result.shared_page_status === 200
    && result.shared_target.hash === `#${fixture.assistant_anchor}`
    && result.shared_target.target_id === fixture.assistant_anchor
    && result.shared_target.expected_exists
    && noOverflow(result.metrics)
    && noOverflow(result.shared_metrics)
    && result.console_errors.length === 0
    && result.shared_console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-chat-share-fixture-2026-05-10.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-chat-share-ux-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    user_id: fixture.user.id,
    document_id: fixture.document_id,
    session_id: fixture.session_id,
    assistant_anchor: fixture.assistant_anchor,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, fixture, baseUrl, screenshotDir, report, "desktop");
    await runViewport(browser, fixture, baseUrl, screenshotDir, report, "mobile");
  } finally {
    await browser.close();
  }

  const desktopOk = validViewport(report.desktop, fixture);
  const mobileOk = validViewport(report.mobile, fixture);
  report.result = desktopOk && mobileOk ? "pass" : "fail";

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.result !== "pass") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
