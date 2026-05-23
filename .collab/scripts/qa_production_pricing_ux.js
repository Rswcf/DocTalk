#!/usr/bin/env node
/* Non-destructive browser UX checks for production /pricing. */

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

function attachObservers(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const apiRequests = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      resource_type: request.resourceType(),
      failure: request.failure()?.errorText || "unknown",
    });
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      apiRequests.push({
        method: request.method(),
        path: `${url.pathname}${url.search}`,
        resource_type: request.resourceType(),
      });
    }
  });
  return { consoleErrors, pageErrors, failedRequests, apiRequests };
}

async function collectPricingState(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || "";
    const links = [...document.querySelectorAll("a")]
      .map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.getAttribute("href") || "",
        absolute_href: anchor.href,
        visible: (() => {
          const rect = anchor.getBoundingClientRect();
          const style = window.getComputedStyle(anchor);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })(),
      }))
      .filter((link) => link.text || link.href);

    const planCards = [...document.querySelectorAll("article")].map((article) => ({
      title: article.querySelector("h2")?.textContent?.trim() || "",
      text: (article.innerText || "").replace(/\s+/g, " ").trim(),
      cta: (() => {
        const anchor = article.querySelector("a[href]");
        return anchor ? {
          text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
          href: anchor.getAttribute("href") || "",
        } : null;
      })(),
    }));

    const comparisonRows = [...document.querySelectorAll("tbody tr")]
      .map((row) => [...row.children].map((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim()))
      .filter((cells) => cells.length > 0);

    const clippedInteractive = [...document.querySelectorAll("button, a, input, textarea, select")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = el.getAttribute("aria-label")
          || el.textContent?.trim()
          || el.getAttribute("href")
          || el.tagName.toLowerCase();
        return { label, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .filter((rect) => rect.left < -1 || rect.right > window.innerWidth + 1);

    return {
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      bodyTextChars: text.replace(/\s+/g, " ").trim().length,
      hasRefundCopy: /refund/i.test(text) && /7-day|7 day|fair-use/i.test(text),
      hasCreditGuide: /credits map to real work/i.test(text) || /credits/i.test(text),
      hasComparison: /comparison|compare/i.test(text) && comparisonRows.length >= 5,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      links,
      planCards,
      comparisonRows,
      clippedInteractive,
    };
  });
}

function hrefHasParams(href, expected) {
  const url = new URL(href, "https://www.doctalk.site");
  return Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value);
}

async function runViewport(browser, baseUrl, viewport, screenshotDir) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: "en-US",
  });
  const page = await context.newPage();
  const observers = attachObservers(page);
  const result = {
    viewport: viewport.name,
    status: null,
    final_url: null,
    metrics: null,
    console_errors: observers.consoleErrors,
    page_errors: observers.pageErrors,
    failed_requests: observers.failedRequests,
    api_requests: observers.apiRequests,
    screenshot: null,
    result: "fail",
  };

  try {
    const response = await page.goto(`${baseUrl}/pricing`, { waitUntil: "networkidle", timeout: 35000 });
    result.status = response ? response.status() : null;
    result.final_url = page.url();
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 30000 });
    result.metrics = await collectPricingState(page);
  } catch (err) {
    result.error = err && err.stack ? err.stack : String(err);
  }

  const metrics = result.metrics || {};
  const planCards = metrics.planCards || [];
  const links = metrics.links || [];
  const freeCard = planCards.find((card) => /free/i.test(card.title));
  const plusCard = planCards.find((card) => /plus/i.test(card.title));
  const proCard = planCards.find((card) => /pro/i.test(card.title));
  const heroPlus = links.find((link) => /upgrade to plus|start plus|plus/i.test(link.text) && link.href.includes("pricing_hero"));
  const demoLink = links.find((link) => /demo/i.test(link.text) && link.href === "/demo" && link.visible);

  result.assertions = {
    page_loaded: result.status >= 200 && result.status < 400,
    h1_mentions_pricing: /pricing|plan|document/i.test(metrics.h1 || ""),
    three_plan_cards: planCards.length >= 3 && Boolean(freeCard && plusCard && proCard),
    free_plan_has_expected_copy: Boolean(freeCard && /\$0|free/i.test(freeCard.text) && /300|500|credits/i.test(freeCard.text)),
    plus_plan_has_expected_copy: Boolean(plusCard && /\$9\.99|plus/i.test(plusCard.text) && /3,000|3000/i.test(plusCard.text)),
    pro_plan_has_expected_copy: Boolean(proCard && /\$19\.99|pro/i.test(proCard.text) && /9,000|9000/i.test(proCard.text)),
    free_cta_goes_to_auth: freeCard?.cta?.href === "/auth",
    plus_cta_has_billing_intent: Boolean(plusCard?.cta?.href && hrefHasParams(plusCard.cta.href, { plan: "plus", period: "monthly", source: "pricing" })),
    pro_cta_has_billing_intent: Boolean(proCard?.cta?.href && hrefHasParams(proCard.cta.href, { plan: "pro", period: "monthly", source: "pricing" })),
    hero_plus_cta_has_source: Boolean(heroPlus?.href && hrefHasParams(heroPlus.href, { plan: "plus", period: "monthly", source: "pricing_hero" })),
    demo_link_visible: Boolean(demoLink?.visible),
    refund_copy_visible: Boolean(metrics.hasRefundCopy),
    credit_guide_visible: Boolean(metrics.hasCreditGuide),
    comparison_table_visible: Boolean(metrics.hasComparison),
    no_horizontal_overflow: metrics.overflowX === false,
    no_clipped_interactive: (metrics.clippedInteractive || []).length === 0,
    no_console_errors: observers.consoleErrors.length === 0,
    no_page_errors: observers.pageErrors.length === 0,
    no_failed_requests: observers.failedRequests.length === 0,
    no_unexpected_api_requests: observers.apiRequests
      .filter((request) => !request.path.startsWith("/api/auth/"))
      .length === 0,
  };
  result.result = Object.values(result.assertions).every(Boolean) ? "pass" : "fail";

  if (result.result !== "pass") {
    const screenshot = path.join(screenshotDir, `production-pricing-ux-${viewport.name}-failure.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    result.screenshot = path.relative(ROOT, screenshot);
  }

  await context.close();
  return result;
}

async function main() {
  const baseUrl = arg("base-url", "https://www.doctalk.site").replace(/\/$/, "");
  const jsonOut = arg("json-out", ".collab/tasks/qa-production-pricing-ux-2026-05-11.json");
  const screenshotDir = path.resolve(ROOT, arg("screenshot-dir", ".collab/tasks/screenshots/2026-05-11/production-pricing-ux"));
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: "desktop", width: 1440, height: 900, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true },
  ];
  const report = {
    run: "qa-production-pricing-ux",
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    destructive: false,
    safety_note: "Read-only browser inspection of pricing content and CTA hrefs. The harness does not click billing CTAs or create checkout sessions.",
    viewports,
    results: [],
  };
  try {
    for (const viewport of viewports) {
      report.results.push(await runViewport(browser, baseUrl, viewport, screenshotDir));
    }
  } finally {
    await browser.close();
  }
  report.summary = {
    total: report.results.length,
    passed: report.results.filter((item) => item.result === "pass").length,
    failed: report.results.filter((item) => item.result !== "pass").length,
  };
  report.result = report.summary.failed === 0 ? "pass" : "fail";
  const out = path.resolve(ROOT, jsonOut);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PRODUCTION_PRICING_UX ${report.result.toUpperCase()}: ${report.summary.passed}/${report.summary.total} viewports passed`);
  if (report.result !== "pass") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
