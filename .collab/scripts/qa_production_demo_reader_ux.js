#!/usr/bin/env node
/* Browser UX checks for production demo reader/citation surfaces without LLM chat. */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "../..");
const frontendRequire = createRequire(path.join(ROOT, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");

function arg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

function isNonBlockingConsoleError(text) {
  return /^Warning: AbortException: TextLayer task cancelled\./.test(text);
}

function relevantNetworkUrl(url) {
  return /\/api\/proxy\/api\/documents\/|\/api\/proxy\/api\/chunks\/|\/api\/proxy\/api\/sessions\/|file-url|pdf\.worker|\.pdf|X-Amz-Signature/.test(url);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${text.slice(0, 300)}`);
  }
  return body;
}

async function buildFixture(backend) {
  const demos = await fetchJson(`${backend}/api/documents/demo`);
  const ready = Array.isArray(demos) ? demos.filter((item) => item && item.status === "ready") : [];
  const selected = ready.find((item) => item.slug === "alphabet-earnings") || ready[0];
  if (!selected) throw new Error("No ready demo document found");

  const search = await fetchJson(`${backend}/api/documents/${selected.document_id}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: selected.slug === "alphabet-earnings" ? "revenue" : "attention", top_k: 3 }),
  });
  const candidates = Array.isArray(search.results) ? search.results : [];
  const target = candidates.find((item) => item.chunk_id && item.page && Array.isArray(item.bboxes) && item.bboxes.length > 0)
    || candidates.find((item) => item.chunk_id && item.page);
  if (!target) throw new Error("No citation-capable search result found for selected demo document");

  return {
    selected_demo: selected,
    search_query: selected.slug === "alphabet-earnings" ? "revenue" : "attention",
    target: {
      chunk_id: target.chunk_id,
      page: target.page,
      bboxes: target.bboxes || [],
      text_preview: String(target.text || "").slice(0, 360),
    },
  };
}

async function inspect(page, targetPage) {
  return await page.evaluate((pageNumber) => {
    const rectOf = (el) => {
      const rect = el.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const visible = (el) => {
      if (el.closest("[aria-hidden='true']")) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden"
        && style.display !== "none"
        && style.opacity !== "0"
        && rect.width > 0
        && rect.height > 0;
    };
    const labelOf = (el) => (
      el.getAttribute("aria-label")
      || el.getAttribute("title")
      || el.textContent
      || el.getAttribute("href")
      || el.tagName
    ).trim().replace(/\s+/g, " ").slice(0, 96);
    const interactive = [...document.querySelectorAll("button,a,input,select,textarea,[role='button']")]
      .filter(visible)
      .filter((el) => !(typeof el.tabIndex === "number" && el.tabIndex < 0));
    const clippedInteractive = interactive
      .map((el) => ({ tag: el.tagName.toLowerCase(), label: labelOf(el), rect: rectOf(el) }))
      .filter((item) => item.rect.left < -2 || item.rect.right > window.innerWidth + 2)
      .slice(0, 20);
    const pageNodes = [...document.querySelectorAll("[data-page-number]")];
    const targetNode = pageNodes.find((el) => Number(el.getAttribute("data-page-number")) === Number(pageNumber));
    const targetRect = targetNode ? targetNode.getBoundingClientRect() : null;
    const targetOverlays = targetNode ? [...targetNode.querySelectorAll(".citation-overlay")] : [];
    const overlayRects = targetOverlays.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        inViewport: rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight,
      };
    });
    const readerPanes = [...document.querySelectorAll(".dt-reader-pane")].filter(visible);
    const chatShells = [...document.querySelectorAll(".dt-chat-shell")].filter(visible);
    const documentTab = [...document.querySelectorAll("button")]
      .filter(visible)
      .find((el) => /document/i.test(el.textContent || ""));
    const chatTab = [...document.querySelectorAll("button")]
      .filter(visible)
      .find((el) => /^chat$/i.test((el.textContent || "").trim()));
    const pageInputs = [...document.querySelectorAll("input")]
      .filter(visible)
      .map((el) => ({
        label: el.getAttribute("aria-label") || "",
        value: el.value,
        rect: rectOf(el),
      }));
    return {
      title: document.title,
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyTextSample: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 1600),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      readerPaneCount: readerPanes.length,
      chatShellVisible: chatShells.length > 0,
      canvasCount: document.querySelectorAll("canvas").length,
      pageNodeCount: pageNodes.length,
      targetPageMountedWithCanvas: Boolean(targetNode && targetNode.querySelector("canvas")),
      targetPageVisible: targetRect ? targetRect.bottom >= 0 && targetRect.top <= window.innerHeight : false,
      targetRect: targetRect ? rectOf(targetNode) : null,
      targetOverlayCount: targetOverlays.length,
      targetOverlayInViewport: overlayRects.some((rect) => rect.inViewport),
      overlayRects: overlayRects.slice(0, 12),
      clippedInteractive,
      pageInputs,
      documentTabSelected: documentTab ? /text-blue/.test(documentTab.getAttribute("class") || "") : null,
      chatTabSelected: chatTab ? /text-blue/.test(chatTab.getAttribute("class") || "") : null,
      visibleButtons: [...document.querySelectorAll("button")]
        .filter(visible)
        .map((el) => labelOf(el))
        .filter(Boolean)
        .slice(0, 40),
    };
  }, targetPage);
}

async function waitForTargetOverlay(page, targetPage) {
  await page.waitForFunction(
    (pageNumber) => {
      const targetNode = [...document.querySelectorAll("[data-page-number]")]
        .find((el) => Number(el.getAttribute("data-page-number")) === Number(pageNumber));
      if (!targetNode || !targetNode.querySelector("canvas")) return false;
      return [...targetNode.querySelectorAll(".citation-overlay")].some((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
      });
    },
    targetPage,
    { timeout: 90000 },
  );
}

async function runViewport(browser, fixture, options) {
  const context = await browser.newContext({
    viewport: options.viewport,
    isMobile: options.isMobile || false,
    hasTouch: options.hasTouch || false,
    locale: "en-US",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const nonBlockingConsoleErrors = [];
  const network = { failed_requests: [], responses: [] };
  const chatRequests = [];
  const sessionIds = [];
  const cleanup = [];
  const screenshotDir = options.screenshotDir;
  const targetPage = fixture.target.page;
  const documentId = fixture.selected_demo.document_id;
  const targetUrl = `${options.baseUrl}/d/${documentId}?page=${targetPage}&highlight=${fixture.target.chunk_id}`;
  const mockSessionId = `qa-mock-session-${options.mode}`;

  if (options.mockSession) {
    await page.route(/\/api\/proxy\/api\/documents\/[^/]+\/sessions$/, async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [] }),
        });
        return;
      }
      if (request.method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            session_id: mockSessionId,
            document_id: documentId,
            title: null,
            created_at: new Date().toISOString(),
            demo_messages_used: 0,
          }),
        });
        return;
      }
      await route.continue();
    });
  }

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isNonBlockingConsoleError(text)) {
      nonBlockingConsoleErrors.push(text);
    } else {
      consoleErrors.push(text);
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("request", (request) => {
    const url = request.url();
    if (/\/api\/proxy\/api\/sessions\/[^/]+\/chat/.test(url)) {
      chatRequests.push({ method: request.method(), url });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!relevantNetworkUrl(url)) return;
    network.failed_requests.push({
      method: request.method(),
      url,
      failure: request.failure()?.errorText || null,
    });
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (relevantNetworkUrl(url)) {
      const headers = response.headers();
      network.responses.push({
        method: response.request().method(),
        url,
        status: response.status(),
        content_type: headers["content-type"] || null,
      });
    }
    if (
      response.request().method() === "POST"
      && /\/api\/proxy\/api\/documents\/[^/]+\/sessions$/.test(url)
      && response.status() === 201
    ) {
      try {
        const body = await response.json();
        if (body && body.session_id) sessionIds.push(body.session_id);
      } catch {
        // Best effort. Missing session id is captured in the assertions.
      }
    }
  });

  let status = "ok";
  let failedStage = null;
  let error = null;
  let responseStatus = null;
  let metrics = null;
  const startedAt = Date.now();
  try {
    failedStage = "goto";
    const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    responseStatus = response ? response.status() : null;
    await page.locator(".dt-reading-workspace").waitFor({ timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    if (options.mode === "mobile") {
      failedStage = "open_mobile_document_tab";
      await page.getByRole("button", { name: /^Document$/, exact: true }).click({ timeout: 20000 });
    }
    failedStage = "wait_target_overlay";
    await waitForTargetOverlay(page, targetPage);
    failedStage = "inspect";
    metrics = await inspect(page, targetPage);
    const screenshot = path.join(screenshotDir, `production-demo-reader-${options.mode}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    metrics.screenshot = screenshot;
  } catch (err) {
    status = "error";
    error = { message: err.message, stack: err.stack };
    const screenshot = path.join(screenshotDir, `production-demo-reader-${options.mode}-failure.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);
    metrics = await inspect(page, targetPage).catch((inspectErr) => ({ inspect_error: inspectErr.message }));
    metrics.screenshot = screenshot;
  }

  if (options.mockSession) {
    for (const sessionId of [...new Set(sessionIds)]) {
      cleanup.push({ session_id: sessionId, status: "mocked" });
    }
  } else {
    for (const sessionId of [...new Set(sessionIds)]) {
      try {
        const deleteResponse = await page.request.delete(`${options.baseUrl}/api/proxy/api/sessions/${sessionId}`);
        cleanup.push({ session_id: sessionId, status: deleteResponse.status() });
      } catch (err) {
        cleanup.push({ session_id: sessionId, error: err.message });
      }
    }
  }

  const assertions = {
    page_loaded: status === "ok" && responseStatus >= 200 && responseStatus < 400,
    final_url_is_reader: Boolean(metrics?.url && metrics.url.includes(`/d/${documentId}`)),
    document_title_visible: Boolean(
      metrics?.title?.toLowerCase().includes("alphabet")
      || metrics?.bodyTextSample?.toLowerCase().includes("alphabet")
      || metrics?.bodyTextSample?.toLowerCase().includes("earnings"),
    ),
    reader_shell_visible: (metrics?.readerPaneCount || 0) >= (options.mode === "desktop" ? 2 : 0),
    chat_surface_visible: options.mode === "desktop" ? Boolean(metrics?.chatShellVisible) : true,
    mobile_document_tab_selected: options.mode === "mobile" ? metrics?.documentTabSelected === true : true,
    pdf_canvas_rendered: (metrics?.canvasCount || 0) > 0,
    target_page_has_canvas: metrics?.targetPageMountedWithCanvas === true,
    citation_overlay_visible: metrics?.targetOverlayInViewport === true,
    no_horizontal_overflow: metrics?.overflowX === false,
    no_clipped_interactive: Array.isArray(metrics?.clippedInteractive) && metrics.clippedInteractive.length === 0,
    no_console_errors: consoleErrors.length === 0,
    no_failed_relevant_requests: network.failed_requests.length === 0,
    no_chat_requests: chatRequests.length === 0,
    created_session_captured: sessionIds.length > 0,
    created_sessions_deleted: sessionIds.length > 0
      && cleanup.every((item) => (options.mockSession ? item.status === "mocked" : item.status === 204)),
  };

  await context.close().catch(() => undefined);
  return {
    mode: options.mode,
    status,
    failed_stage: status === "ok" ? null : failedStage,
    error,
    response_status: responseStatus,
    elapsed_ms: Date.now() - startedAt,
    session_ids: sessionIds,
    cleanup,
    chat_requests: chatRequests,
    console_errors: consoleErrors,
    non_blocking_console_errors: nonBlockingConsoleErrors,
    network,
    metrics,
    assertions,
    result: Object.values(assertions).every(Boolean) ? "pass" : "fail",
  };
}

async function main() {
  const baseUrl = arg("base-url", "https://www.doctalk.site").replace(/\/$/, "");
  const backend = arg("backend", "https://backend-production-a62e.up.railway.app").replace(/\/$/, "");
  const jsonOut = arg("json-out", path.join(ROOT, ".collab/tasks/qa-production-demo-reader-ux-2026-05-11.json"));
  const screenshotDir = arg("screenshot-dir", path.join(ROOT, ".collab/tasks/screenshots/2026-05-11/production-demo-reader"));
  const mockSession = arg("mock-session", "false") === "true";
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = await buildFixture(backend);
  const browser = await chromium.launch({ headless: true });
  const report = {
    run: "qa-production-demo-reader-ux",
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    backend,
    mock_session: mockSession,
    fixture,
    desktop: null,
    mobile: null,
  };
  try {
    report.desktop = await runViewport(browser, fixture, {
      mode: "desktop",
      baseUrl,
      screenshotDir,
      mockSession,
      viewport: { width: 1440, height: 900 },
    });
    report.mobile = await runViewport(browser, fixture, {
      mode: "mobile",
      baseUrl,
      screenshotDir,
      mockSession,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  } finally {
    await browser.close();
  }

  report.result = report.desktop.result === "pass" && report.mobile.result === "pass" ? "pass" : "fail";
  report.summary = {
    desktop_result: report.desktop.result,
    mobile_result: report.mobile.result,
    selected_slug: fixture.selected_demo.slug,
    document_id: fixture.selected_demo.document_id,
    target_page: fixture.target.page,
    target_chunk_id: fixture.target.chunk_id,
    desktop_canvas_count: report.desktop.metrics?.canvasCount ?? null,
    mobile_canvas_count: report.mobile.metrics?.canvasCount ?? null,
    desktop_overlay_count: report.desktop.metrics?.targetOverlayCount ?? null,
    mobile_overlay_count: report.mobile.metrics?.targetOverlayCount ?? null,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
    desktop_chat_requests: report.desktop.chat_requests.length,
    mobile_chat_requests: report.mobile.chat_requests.length,
    deleted_sessions: [
      ...report.desktop.cleanup.map((item) => item.status),
      ...report.mobile.cleanup.map((item) => item.status),
    ],
  };

  fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PRODUCTION_DEMO_READER_UX ${report.result.toUpperCase()}: desktop=${report.desktop.result} mobile=${report.mobile.result}`);
  if (report.result !== "pass") process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
