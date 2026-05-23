#!/usr/bin/env node
/* Browser UX checks for public shared-session pages. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "../..");
const frontendRequire = createRequire(path.join(ROOT, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");
const { encode } = frontendRequire("next-auth/jwt");

const PRIVATE_FIELD_PATTERNS = [
  "chunk_id",
  "chunkId",
  "document_id",
  "documentId",
  "bboxes",
  "confidence_score",
  "confidenceScore",
];

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

function attachConsole(page) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  return consoleErrors;
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
    const headings = [...document.querySelectorAll("h1,h2")]
      .filter(isVisible)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || "").trim().slice(0, 120) }))
      .slice(0, 8);
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
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      headings,
      clippedInteractive,
    };
  });
}

async function pagePrivacyScan(page, fixture) {
  return await page.evaluate(({ patterns, documentId, chunkId }) => {
    const html = document.documentElement.outerHTML;
    const text = document.body.innerText;
    const combined = `${html}\n${text}`;
    const foundPatterns = patterns.filter((pattern) => combined.includes(pattern));
    return {
      found_private_field_names: foundPatterns,
      contains_document_id: documentId ? combined.includes(documentId) : false,
      contains_chunk_id: chunkId ? combined.includes(chunkId) : false,
    };
  }, {
    patterns: PRIVATE_FIELD_PATTERNS,
    documentId: fixture.document_id,
    chunkId: fixture.chunk_id,
  });
}

async function apiPrivacyScan(request, apiBase, fixture) {
  const res = await request.get(`${apiBase}/api/shared/${fixture.share_token}`);
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = { text: await res.text() };
  }
  const raw = JSON.stringify(body);
  return {
    status: res.status(),
    message_count: Array.isArray(body.messages) ? body.messages.length : null,
    session_title: body.session_title || null,
    document_name: body.document_name || null,
    found_private_field_names: PRIVATE_FIELD_PATTERNS.filter((pattern) => raw.includes(pattern)),
    contains_document_id: raw.includes(fixture.document_id),
    contains_chunk_id: raw.includes(fixture.chunk_id),
  };
}

async function runDesktop(browser, fixture, baseUrl, apiBase, screenshotDir, report) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);

  const apiScan = await apiPrivacyScan(page.request, apiBase, fixture);
  const sharedUrl = `${baseUrl}/shared/${fixture.share_token}#${fixture.assistant_anchor}`;
  const response = await page.goto(sharedUrl, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /QA shared browser session/);
  await waitForVisibleText(page, /semiconductor reports|semiconductor reading list|related market materials/);
  await waitForVisibleText(page, /Powered by DocTalk/);
  const title = await page.title();
  const metrics = await layoutMetrics(page);
  const privacy = await pagePrivacyScan(page, fixture);
  const target = await page.evaluate((anchor) => {
    const el = document.querySelector(":target");
    const expected = document.getElementById(anchor);
    const rect = expected ? expected.getBoundingClientRect() : null;
    return {
      hash: window.location.hash,
      target_id: el ? el.id : null,
      expected_exists: Boolean(expected),
      expected_top: rect ? Math.round(rect.top) : null,
      expected_height: rect ? Math.round(rect.height) : null,
    };
  }, fixture.assistant_anchor);
  const ctaHref = await page.getByRole("link", { name: /Try DocTalk Free/i }).getAttribute("href");
  const screenshot = path.join(screenshotDir, "sharing-desktop-anchor.png");
  await page.screenshot({ path: screenshot, fullPage: false });
  const validConsoleErrors = [...consoleErrors];

  const invalidPage = await context.newPage();
  const invalidToken = crypto.randomUUID();
  const invalidResponse = await invalidPage.goto(`${baseUrl}/shared/${invalidToken}`, { waitUntil: "domcontentloaded" });
  await invalidPage.close();

  report.desktop = {
    status: response ? response.status() : null,
    title,
    api_privacy: apiScan,
    privacy,
    target,
    cta_href: ctaHref,
    metrics,
    invalid_token_status: invalidResponse ? invalidResponse.status() : null,
    screenshot,
    console_errors: validConsoleErrors,
  };

  await context.close();
}

async function runMobile(browser, fixture, baseUrl, screenshotDir, report) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);
  const response = await page.goto(`${baseUrl}/shared/${fixture.share_token}#${fixture.assistant_anchor}`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /QA shared browser session/);
  await waitForVisibleText(page, /Powered by DocTalk/);
  const metrics = await layoutMetrics(page);
  const privacy = await pagePrivacyScan(page, fixture);
  const target = await page.evaluate((anchor) => ({
    hash: window.location.hash,
    target_id: document.querySelector(":target")?.id || null,
    expected_exists: Boolean(document.getElementById(anchor)),
  }), fixture.assistant_anchor);
  const screenshot = path.join(screenshotDir, "sharing-mobile-anchor.png");
  await page.screenshot({ path: screenshot, fullPage: false });

  report.mobile = {
    status: response ? response.status() : null,
    metrics,
    privacy,
    target,
    screenshot,
    console_errors: consoleErrors,
  };

  await context.close();
}

async function runRevoke(browser, fixture, baseUrl, report) {
  const authContext = await browser.newContext();
  await authContext.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const authPage = await authContext.newPage();
  const revoke = await authPage.request.delete(`${baseUrl}/api/proxy/api/sessions/${fixture.session_id}/share`);
  await authContext.close();

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  const revoked = await publicPage.goto(`${baseUrl}/shared/${fixture.share_token}`, { waitUntil: "domcontentloaded" });
  await publicContext.close();

  report.revoke = {
    revoke_status: revoke.status(),
    revoked_public_status: revoked ? revoked.status() : null,
  };
}

function noPrivate(scan) {
  return scan
    && Array.isArray(scan.found_private_field_names)
    && scan.found_private_field_names.length === 0
    && !scan.contains_document_id
    && !scan.contains_chunk_id;
}

function noOverflow(metrics) {
  return metrics && !metrics.overflowX && (!metrics.clippedInteractive || metrics.clippedInteractive.length === 0);
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-sharing-fixture-2026-05-10.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const apiBase = arg("api-base", "http://127.0.0.1:8000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-sharing-ux-2026-05-10.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-10");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    api_base: apiBase,
    fixture_path: fixturePath,
    user_id: fixture.user.id,
    document_id: fixture.document_id,
    session_id: fixture.session_id,
    share_token: fixture.share_token,
    assistant_anchor: fixture.assistant_anchor,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktop(browser, fixture, baseUrl, apiBase, screenshotDir, report);
    await runMobile(browser, fixture, baseUrl, screenshotDir, report);
    await runRevoke(browser, fixture, baseUrl, report);
  } finally {
    await browser.close();
  }

  const desktopOk =
    report.desktop.status === 200 &&
    report.desktop.api_privacy.status === 200 &&
    report.desktop.api_privacy.message_count === 2 &&
    noPrivate(report.desktop.api_privacy) &&
    noPrivate(report.desktop.privacy) &&
    report.desktop.target.hash === `#${fixture.assistant_anchor}` &&
    report.desktop.target.target_id === fixture.assistant_anchor &&
    report.desktop.target.expected_exists &&
    report.desktop.cta_href === "https://www.doctalk.site" &&
    report.desktop.invalid_token_status === 404 &&
    noOverflow(report.desktop.metrics) &&
    report.desktop.console_errors.length === 0;

  const mobileOk =
    report.mobile.status === 200 &&
    noPrivate(report.mobile.privacy) &&
    report.mobile.target.hash === `#${fixture.assistant_anchor}` &&
    report.mobile.target.target_id === fixture.assistant_anchor &&
    report.mobile.target.expected_exists &&
    noOverflow(report.mobile.metrics) &&
    report.mobile.console_errors.length === 0;

  const revokeOk =
    (report.revoke.revoke_status === 204 || report.revoke.revoke_status === 404) &&
    report.revoke.revoked_public_status === 404;

  report.result = desktopOk && mobileOk && revokeOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    revoke_ok: revokeOk,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: browser sharing UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser sharing UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
