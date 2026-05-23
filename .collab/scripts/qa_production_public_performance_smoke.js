#!/usr/bin/env node
/* Production public-page browser performance and reliability smoke. */

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

function loadRoutes(inventoryPath) {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  return (inventory.concrete || [])
    .filter((route) => route.kind !== "gated")
    .filter((route) => !route.requires)
    .filter((route) => route.template !== "/demo/[sample]")
    .filter((route) => !route.route.includes("["))
    .map((route) => route.route)
    .sort();
}

function percentile(values, p) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function collectTiming(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const byType = {};
    for (const item of resources) {
      const key = item.initiatorType || "other";
      if (!byType[key]) {
        byType[key] = { count: 0, transferSize: 0, encodedBodySize: 0, durationMs: 0 };
      }
      byType[key].count += 1;
      byType[key].transferSize += Math.max(0, Math.round(item.transferSize || 0));
      byType[key].encodedBodySize += Math.max(0, Math.round(item.encodedBodySize || 0));
      byType[key].durationMs += Math.max(0, Math.round(item.duration || 0));
    }
    return {
      navigation: nav ? {
        type: nav.type,
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        responseEndMs: Math.round(nav.responseEnd),
        transferSize: Math.round(nav.transferSize || 0),
        encodedBodySize: Math.round(nav.encodedBodySize || 0),
      } : null,
      resources: {
        count: resources.length,
        transferSize: resources.reduce((sum, item) => sum + Math.max(0, Math.round(item.transferSize || 0)), 0),
        encodedBodySize: resources.reduce((sum, item) => sum + Math.max(0, Math.round(item.encodedBodySize || 0)), 0),
        byType,
      },
      document: {
        title: document.title,
        bodyTextChars: (document.body.innerText || "").replace(/\s+/g, " ").trim().length,
        h1Count: [...document.querySelectorAll("h1")]
          .filter((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          }).length,
      },
    };
  });
}

function routeWarnings(item, budgets) {
  const warnings = [];
  const nav = item.metrics?.navigation;
  const resources = item.metrics?.resources;
  if (nav?.domContentLoadedMs > budgets.domContentLoadedMs) {
    warnings.push({ name: "slow_domcontentloaded", observed: nav.domContentLoadedMs, budget: budgets.domContentLoadedMs });
  }
  if (nav?.loadMs > budgets.loadMs) {
    warnings.push({ name: "slow_load", observed: nav.loadMs, budget: budgets.loadMs });
  }
  if (resources?.count > budgets.resourceCount) {
    warnings.push({ name: "high_resource_count", observed: resources.count, budget: budgets.resourceCount });
  }
  if (resources?.transferSize > budgets.transferBytes) {
    warnings.push({ name: "high_transfer_size", observed: resources.transferSize, budget: budgets.transferBytes });
  }
  if (item.failedRequests.length > 0) {
    warnings.push({ name: "failed_requests", observed: item.failedRequests.length });
  }
  if (item.consoleErrors.length > 0) {
    warnings.push({ name: "console_errors", observed: item.consoleErrors.length });
  }
  return warnings;
}

function routePass(item) {
  return item.status >= 200
    && item.status < 400
    && !item.error
    && item.pageErrors.length === 0
    && item.metrics?.document?.bodyTextChars > 120;
}

async function runRoute(context, baseUrl, route, viewport, budgets) {
  const page = await context.newPage();
  const started = Date.now();
  const responses = [];
  const failedRequests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on("response", (response) => {
    const headers = response.headers();
    const contentLength = Number(headers["content-length"] || "0") || null;
    responses.push({
      url: response.url(),
      status: response.status(),
      request_method: response.request().method(),
      resource_type: response.request().resourceType(),
      content_length: contentLength,
    });
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      resource_type: request.resourceType(),
      failure: request.failure()?.errorText || "unknown",
    });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  let response = null;
  let metrics = null;
  let error = null;
  try {
    response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
    metrics = await collectTiming(page);
  } catch (err) {
    error = err && err.stack ? err.stack : String(err);
    metrics = await collectTiming(page).catch(() => null);
  }
  const item = {
    route,
    viewport: viewport.name,
    status: response ? response.status() : 0,
    final_url: page.url().replace(baseUrl, ""),
    elapsed_ms: Date.now() - started,
    response_count: responses.length,
    failedRequests: failedRequests.slice(0, 20),
    failed_request_count: failedRequests.length,
    consoleErrors: consoleErrors.slice(0, 20),
    console_error_count: consoleErrors.length,
    pageErrors,
    page_error_count: pageErrors.length,
    status_error_responses: responses
      .filter((entry) => entry.status >= 400)
      .slice(0, 30),
    status_error_response_count: responses.filter((entry) => entry.status >= 400).length,
    metrics,
    error,
  };
  item.warnings = routeWarnings(item, budgets);
  item.result = routePass(item) ? "pass" : "fail";
  await page.close();
  return item;
}

async function main() {
  const baseUrl = arg("base-url", "https://www.doctalk.site").replace(/\/$/, "");
  const inventoryPath = arg("inventory", path.join(ROOT, ".collab/tasks/qa-route-inventory-2026-05-10.json"));
  const jsonOut = arg("json-out", path.join(ROOT, ".collab/tasks/qa-production-public-performance-smoke-2026-05-11.json"));
  const limit = Number(arg("limit", "0"));
  const budgets = {
    domContentLoadedMs: Number(arg("budget-domcontentloaded-ms", "5000")),
    loadMs: Number(arg("budget-load-ms", "9000")),
    resourceCount: Number(arg("budget-resource-count", "100")),
    transferBytes: Number(arg("budget-transfer-bytes", String(4 * 1024 * 1024))),
  };
  const allRoutes = loadRoutes(inventoryPath);
  const routes = limit > 0 ? allRoutes.slice(0, limit) : allRoutes;
  const viewports = [
    { name: "desktop", width: 1366, height: 900, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true },
  ];

  const browser = await chromium.launch({ headless: true });
  const report = {
    run: "qa-production-public-performance-smoke",
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    inventory: inventoryPath,
    budgets,
    route_count: routes.length,
    viewports,
    results: [],
  };
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: "en-US",
        isMobile: viewport.isMobile,
      });
      try {
        for (const route of routes) {
          report.results.push(await runRoute(context, baseUrl, route, viewport, budgets));
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const domContentLoaded = report.results.map((item) => item.metrics?.navigation?.domContentLoadedMs);
  const load = report.results.map((item) => item.metrics?.navigation?.loadMs);
  const resourceCounts = report.results.map((item) => item.metrics?.resources?.count);
  const transferSizes = report.results.map((item) => item.metrics?.resources?.transferSize);
  const failed = report.results.filter((item) => item.result !== "pass");
  const warningItems = report.results.filter((item) => item.warnings.length > 0);
  report.summary = {
    total_checks: report.results.length,
    passed: report.results.length - failed.length,
    failed: failed.length,
    warning_checks: warningItems.length,
    console_error_checks: report.results.filter((item) => item.console_error_count > 0).length,
    failed_request_checks: report.results.filter((item) => item.failed_request_count > 0).length,
    page_error_checks: report.results.filter((item) => item.page_error_count > 0).length,
    status_error_response_checks: report.results.filter((item) => item.status_error_response_count > 0).length,
    domContentLoadedMs: {
      p50: percentile(domContentLoaded, 50),
      p90: percentile(domContentLoaded, 90),
      max: Math.max(...domContentLoaded.filter((value) => typeof value === "number")),
    },
    loadMs: {
      p50: percentile(load, 50),
      p90: percentile(load, 90),
      max: Math.max(...load.filter((value) => typeof value === "number")),
    },
    resourceCount: {
      p50: percentile(resourceCounts, 50),
      p90: percentile(resourceCounts, 90),
      max: Math.max(...resourceCounts.filter((value) => typeof value === "number")),
    },
    transferBytes: {
      p50: percentile(transferSizes, 50),
      p90: percentile(transferSizes, 90),
      max: Math.max(...transferSizes.filter((value) => typeof value === "number")),
    },
    top_slowest_load: [...report.results]
      .sort((a, b) => (b.metrics?.navigation?.loadMs || 0) - (a.metrics?.navigation?.loadMs || 0))
      .slice(0, 10)
      .map((item) => ({
        route: item.route,
        viewport: item.viewport,
        loadMs: item.metrics?.navigation?.loadMs,
        domContentLoadedMs: item.metrics?.navigation?.domContentLoadedMs,
        resourceCount: item.metrics?.resources?.count,
        transferSize: item.metrics?.resources?.transferSize,
      })),
  };
  report.result = failed.length > 0 ? "fail" : (warningItems.length > 0 ? "pass_with_warning" : "pass");
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `PRODUCTION_PUBLIC_PERFORMANCE_SMOKE ${report.result.toUpperCase()}: `
    + `${report.summary.passed}/${report.summary.total_checks} viewport-route checks passed, `
    + `warnings=${report.summary.warning_checks}`,
  );
  for (const item of failed.slice(0, 20)) {
    console.log(`FAIL ${item.viewport} ${item.route}: status=${item.status} pageErrors=${item.page_error_count}`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
