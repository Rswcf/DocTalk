#!/usr/bin/env node
/* Browser UX checks for long-PDF reader virtualization and late citation jump. */

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

function relevantNetworkUrl(url) {
  return /\/api\/proxy\/api\/documents\/|\/api\/documents\/|file-url|localhost:9000|127\.0\.0\.1:9000|\.pdf|pdf\.worker|pdf\.mjs/.test(
    url,
  );
}

function boundedPush(items, item, limit = 120) {
  items.push(item);
  if (items.length > limit) items.shift();
}

function isNonBlockingPdfJsWarning(text) {
  return /^Warning: AbortException: TextLayer task cancelled\./.test(text);
}

async function safePageInfo(page) {
  try {
    return { title: await page.title(), url: page.url() };
  } catch (err) {
    return { title: null, url: null, error: err.message };
  }
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

async function metrics(page, targetPage) {
  return await page.evaluate((target) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const pageNodes = [...document.querySelectorAll("[data-page-number]")];
    const pageNumbers = pageNodes
      .map((el) => Number(el.getAttribute("data-page-number")))
      .filter((n) => Number.isFinite(n));
    const uniquePageNumbers = [...new Set(pageNumbers)].sort((a, b) => a - b);
    const canvasPages = [...new Set(pageNodes
      .filter((el) => el.querySelector("canvas"))
      .map((el) => Number(el.getAttribute("data-page-number")))
      .filter((n) => Number.isFinite(n)))]
      .sort((a, b) => a - b);
    const visibleCanvasPages = [...new Set(pageNodes
      .filter((el) => el.querySelector("canvas") && visible(el))
      .map((el) => Number(el.getAttribute("data-page-number")))
      .filter((n) => Number.isFinite(n)))]
      .sort((a, b) => a - b);
    const targetNodes = pageNodes.filter((el) => Number(el.getAttribute("data-page-number")) === target);
    const targetNode =
      targetNodes.find((el) => {
        const r = el.getBoundingClientRect();
        return visible(el) && r.bottom >= 0 && r.top <= window.innerHeight;
      }) ||
      targetNodes.find(visible) ||
      targetNodes[0];
    const targetRect = targetNode ? targetNode.getBoundingClientRect() : null;
    const overlayRects = [...document.querySelectorAll(".citation-overlay")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        visible: r.width > 0 && r.height > 0 && r.bottom >= 0 && r.top <= window.innerHeight,
      };
    });
    const pageInputs = [...document.querySelectorAll("input")].map((el) => ({
      value: el.value,
      label: el.getAttribute("aria-label") || "",
      visible: visible(el),
    }));
    const sourceButtons = [...document.querySelectorAll(".dt-source-index")]
      .filter(visible)
      .map((el) => el.textContent || "");
    const documentTab = [...document.querySelectorAll("button")]
      .find((el) => visible(el) && /document/i.test(el.textContent || ""));
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      bodyTextSample: (document.body.textContent || "").slice(0, 1200),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      pageNodeCount: pageNodes.length,
      uniquePageCount: uniquePageNumbers.length,
      firstPageNumbers: uniquePageNumbers.slice(0, 8),
      lastPageNumbers: uniquePageNumbers.slice(-8),
      canvasCount: document.querySelectorAll("canvas").length,
      canvasPages,
      visibleCanvasPages,
      targetPageMountedWithCanvas: canvasPages.includes(target),
      targetPageVisible: targetRect ? targetRect.bottom >= 0 && targetRect.top <= window.innerHeight : false,
      targetRect: targetRect ? { x: targetRect.x, y: targetRect.y, w: targetRect.width, h: targetRect.height } : null,
      overlayCount: overlayRects.length,
      overlayInViewport: overlayRects.some((r) => r.visible),
      sourceButtons,
      pageInputs,
      documentTabSelected: documentTab ? /text-blue/.test(documentTab.getAttribute("class") || "") : null,
    };
  }, targetPage);
}

async function debugSnapshot(page, targetPage) {
  const pageInfo = await safePageInfo(page);
  let currentMetrics = null;
  let dom = null;
  try {
    currentMetrics = await metrics(page, targetPage);
  } catch (err) {
    currentMetrics = { error: err.message };
  }
  try {
    dom = await page.evaluate((target) => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const pages = [...document.querySelectorAll("[data-page-number]")].map((el) => ({
        page: Number(el.getAttribute("data-page-number")),
        has_canvas: Boolean(el.querySelector("canvas")),
        class_name: el.getAttribute("class") || "",
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })(),
      }));
      const canvases = [...document.querySelectorAll("canvas")].map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, attr_w: el.width, attr_h: el.height, visible: visible(el) };
      });
      const messages = [...document.querySelectorAll(".react-pdf__message, [role='alert'], [aria-live]")]
        .filter(visible)
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean);
      const buttons = [...document.querySelectorAll("button")]
        .filter(visible)
        .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 40);
      return {
        ready_state: document.readyState,
        body_text: (document.body.textContent || "").replace(/\s+/g, " ").slice(0, 5000),
        react_pdf_document_count: document.querySelectorAll(".react-pdf__Document").length,
        react_pdf_page_count: document.querySelectorAll(".react-pdf__Page").length,
        page_count: pages.length,
        first_pages: pages.slice(0, 8),
        last_pages: pages.slice(-8),
        target_page: pages.find((entry) => entry.page === target) || null,
        canvas_count: canvases.length,
        first_canvases: canvases.slice(0, 12),
        messages,
        buttons,
      };
    }, targetPage);
  } catch (err) {
    dom = { error: err.message };
  }
  return { ...pageInfo, metrics: currentMetrics, dom };
}

async function runViewport(browser, fixture, baseUrl, screenshotDir, name, viewportOptions, flowOptions = {}) {
  const context = await browser.newContext({
    ...viewportOptions,
    acceptDownloads: true,
  });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = [];
  const nonBlockingConsoleWarnings = [];
  const network = {
    failed_requests: [],
    responses: [],
  };
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isNonBlockingPdfJsWarning(text)) {
      nonBlockingConsoleWarnings.push(text);
    } else {
      consoleErrors.push(text);
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!relevantNetworkUrl(url)) return;
    boundedPush(network.failed_requests, {
      url,
      method: request.method(),
      failure: request.failure()?.errorText || null,
    });
  });
  page.on("response", (response) => {
    const url = response.url();
    if (!relevantNetworkUrl(url)) return;
    const headers = response.headers();
    boundedPush(network.responses, {
      url,
      status: response.status(),
      content_type: headers["content-type"] || null,
      content_length: headers["content-length"] || null,
    });
  });

  const start = Date.now();
  let stage = "goto";
  try {
    await page.goto(`${baseUrl}/d/${fixture.document_id}`, { waitUntil: "domcontentloaded" });
    stage = "wait_source_button";
    await page.locator(".dt-source-index:visible").first().waitFor({ timeout: 60000 });
    const answerReadyMs = Date.now() - start;
    let firstCanvasMs = null;
    if (flowOptions.waitForVisibleCanvasBeforeCitation !== false) {
      stage = "wait_first_canvas";
      await page.locator("canvas:visible").first().waitFor({ timeout: 90000 });
      firstCanvasMs = Date.now() - start;
    }
    const before = await metrics(page, fixture.target.page);

    stage = "click_source_button";
    const clickStart = Date.now();
    await page.locator(".dt-source-index:visible").first().click();
    stage = "wait_target_page_overlay";
    await page.waitForFunction(
      (target) => {
        const pages = [...document.querySelectorAll("[data-page-number]")]
          .filter((el) => el.querySelector("canvas"))
          .map((el) => Number(el.getAttribute("data-page-number")));
        const overlayVisible = [...document.querySelectorAll(".citation-overlay")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.top <= window.innerHeight;
        });
        return pages.includes(target) && overlayVisible;
      },
      fixture.target.page,
      { timeout: 90000 },
    );
    const citationJumpMs = Date.now() - clickStart;
    const after = await metrics(page, fixture.target.page);
    const screenshot = path.join(screenshotDir, `long-pdf-citation-${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const { title, url } = await safePageInfo(page);

    return {
      status: "ok",
      url,
      title,
      answer_ready_ms: answerReadyMs,
      first_canvas_ms: firstCanvasMs,
      citation_jump_ms: citationJumpMs,
      before,
      after,
      screenshot,
      console_errors: consoleErrors,
      non_blocking_console_warnings: nonBlockingConsoleWarnings,
      network,
    };
  } catch (err) {
    const screenshot = path.join(screenshotDir, `long-pdf-citation-${name}-failure.png`);
    try {
      await page.screenshot({ path: screenshot, fullPage: false });
    } catch (_) {
      // Screenshot capture is best-effort for failure diagnostics.
    }
    const debug = await debugSnapshot(page, fixture.target.page);
    return {
      status: "error",
      failed_stage: stage,
      elapsed_ms: Date.now() - start,
      error: { message: err.message, stack: err.stack },
      screenshot,
      debug,
      console_errors: consoleErrors,
      non_blocking_console_warnings: nonBlockingConsoleWarnings,
      network,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function pdfFullResponseCount(viewport) {
  return (viewport?.network?.responses || []).filter(
    (response) => response.status === 200 && response.content_type === "application/pdf",
  ).length;
}

function viewportOk(viewport, fixture, options = {}) {
  const requireDocumentTab = options.requireDocumentTab === true;
  const requireBeforePages = options.requireBeforePages !== false;
  return (
    viewport?.status === "ok" &&
    (!requireBeforePages || viewport.before.uniquePageCount >= fixture.target.page) &&
    viewport.after.uniquePageCount >= fixture.target.page &&
    viewport.before.canvasCount <= 20 &&
    viewport.after.targetPageMountedWithCanvas &&
    viewport.after.overlayInViewport &&
    viewport.after.canvasCount <= 20 &&
    pdfFullResponseCount(viewport) <= 1 &&
    (!requireDocumentTab || viewport.after.documentTabSelected === true) &&
    !viewport.after.overflowX &&
    viewport.console_errors.length === 0
  );
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-long-pdf-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://127.0.0.1:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-long-pdf-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (!fixture.user || !fixture.document_id || !fixture.session_id || !fixture.target?.page) {
    throw new Error("Fixture must include user, document_id, session_id, and target.page");
  }

  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    document_id: fixture.document_id,
    session_id: fixture.session_id,
    target: fixture.target,
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
      { waitForVisibleCanvasBeforeCitation: false },
    );
  } finally {
    await browser.close();
  }

  const desktopOk = viewportOk(report.desktop, fixture, { requireDocumentTab: false });
  const mobileOk = viewportOk(report.mobile, fixture, { requireDocumentTab: true, requireBeforePages: false });

  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    target_page: fixture.target.page,
    desktop_status: report.desktop.status,
    mobile_status: report.mobile.status,
    desktop_failed_stage: report.desktop.failed_stage || null,
    mobile_failed_stage: report.mobile.failed_stage || null,
    desktop_initial_canvas_count: report.desktop.before?.canvasCount ?? report.desktop.debug?.metrics?.canvasCount ?? null,
    desktop_after_canvas_count: report.desktop.after?.canvasCount ?? null,
    desktop_unique_pages_before: report.desktop.before?.uniquePageCount ?? null,
    desktop_unique_pages_after: report.desktop.after?.uniquePageCount ?? null,
    desktop_pdf_full_response_count: pdfFullResponseCount(report.desktop),
    mobile_initial_canvas_count: report.mobile.before?.canvasCount ?? report.mobile.debug?.metrics?.canvasCount ?? null,
    mobile_after_canvas_count: report.mobile.after?.canvasCount ?? null,
    mobile_unique_pages_before: report.mobile.before?.uniquePageCount ?? null,
    mobile_unique_pages_after: report.mobile.after?.uniquePageCount ?? null,
    mobile_pdf_full_response_count: pdfFullResponseCount(report.mobile),
    desktop_citation_jump_ms: report.desktop.citation_jump_ms ?? null,
    mobile_citation_jump_ms: report.mobile.citation_jump_ms ?? null,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
    desktop_non_blocking_console_warnings: report.desktop.non_blocking_console_warnings?.length ?? 0,
    mobile_non_blocking_console_warnings: report.mobile.non_blocking_console_warnings?.length ?? 0,
    desktop_overflow: report.desktop.after?.overflowX ?? report.desktop.debug?.metrics?.overflowX ?? null,
    mobile_overflow: report.mobile.after?.overflowX ?? report.mobile.debug?.metrics?.overflowX ?? null,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: long PDF browser UX checks failed; wrote ${outPath}`);
    process.exit(1);
  }
  console.log(`PASS: long PDF browser UX checks; wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
