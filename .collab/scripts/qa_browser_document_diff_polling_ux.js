#!/usr/bin/env node
/* Browser UX check for Document Diff running -> succeeded polling. */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
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

function runFixtureCommand(args) {
  const script = path.join(ROOT, ".collab/scripts/qa_browser_document_diff_result_fixture.py");
  execFileSync("python3", [script, ...args], { cwd: ROOT, stdio: "pipe" });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

async function metrics(page) {
  return await page.evaluate(() => ({
    viewport: { w: window.innerWidth, h: window.innerHeight },
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    bodyText: document.body.innerText,
    buttons: [...document.querySelectorAll("button")]
      .map((button) => (button.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  }));
}

async function runViewport(browser, baseUrl, screenshotDir, name, viewportOptions) {
  const fixturePath = path.join(ROOT, `.collab/tasks/qa-browser-document-diff-polling-fixture-${name}-2026-05-11.json`);
  const completePath = path.join(ROOT, `.collab/tasks/qa-browser-document-diff-polling-complete-${name}-2026-05-11.json`);
  const cleanupPath = path.join(ROOT, `.collab/tasks/qa-browser-document-diff-polling-cleanup-${name}-2026-05-11.json`);
  runFixtureCommand(["create-running", "--json-out", fixturePath]);
  const fixture = readJson(fixturePath);
  let cleanup = null;
  let context = null;
  try {
    context = await browser.newContext({ ...viewportOptions });
    await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto(`${baseUrl}/document-diff`, { waitUntil: "domcontentloaded" });
    await waitForVisibleText(page, /Semantic document diff|Compare two versions/i, 60000);
    await waitForVisibleText(page, /Status:\s*running|The comparison report will appear here/i);
    const before = await metrics(page);

    runFixtureCommand(["complete", "--job-id", fixture.job_id, "--json-out", completePath]);
    const complete = readJson(completePath);
    await waitForVisibleText(page, /Completed/i, 20000);
    await waitForVisibleText(page, /Refund window extended/i, 20000);
    await waitForVisibleText(page, /Enterprise annual plans added/i, 20000);
    await waitForVisibleText(page, /O1/i, 20000);
    await waitForVisibleText(page, /N1/i, 20000);
    const after = await metrics(page);
    const screenshot = path.join(screenshotDir, `document-diff-polling-${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });

    return {
      fixture_path: fixturePath,
      complete_path: completePath,
      cleanup_path: cleanupPath,
      fixture,
      complete,
      before,
      after,
      screenshot,
      console_errors: consoleErrors,
    };
  } finally {
    if (context) await context.close();
    if (fixture?.user?.id) {
      runFixtureCommand(["cleanup", "--user-id", fixture.user.id, "--json-out", cleanupPath]);
      cleanup = readJson(cleanupPath);
    }
    if (cleanup) {
      // The caller reads cleanup_path; keep this branch to guarantee cleanup runs before return on success.
    }
  }
}

async function main() {
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-document-diff-polling-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
  };
  try {
    report.desktop = await runViewport(
      browser,
      baseUrl,
      screenshotDir,
      "desktop",
      { viewport: { width: 1440, height: 900 } },
    );
    report.mobile = await runViewport(
      browser,
      baseUrl,
      screenshotDir,
      "mobile",
      { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    );
  } finally {
    await browser.close();
  }

  function ok(view) {
    const beforeText = view.before.bodyText;
    const afterText = view.after.bodyText;
    const cleanup = readJson(view.cleanup_path);
    return /Status:\s*running|The comparison report will appear here/i.test(beforeText)
      && !/Refund window extended/i.test(beforeText)
      && /Completed/i.test(afterText)
      && /Refund window extended/i.test(afterText)
      && /Enterprise annual plans added/i.test(afterText)
      && /O1/i.test(afterText)
      && /N1/i.test(afterText)
      && view.complete.status === "succeeded"
      && cleanup.users === 0
      && cleanup.documents === 0
      && cleanup.jobs === 0
      && !view.after.overflowX
      && view.console_errors.length === 0;
  }

  const desktopOk = ok(report.desktop);
  const mobileOk = ok(report.mobile);
  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
    desktop_cleanup: readJson(report.desktop.cleanup_path),
    mobile_cleanup: readJson(report.mobile.cleanup_path),
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: browser document diff polling UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: browser document diff polling UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
