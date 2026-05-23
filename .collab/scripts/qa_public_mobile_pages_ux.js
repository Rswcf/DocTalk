#!/usr/bin/env node
/* Mobile browser UX sweep for public DocTalk routes. */

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

function routeSlug(route) {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
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

async function inspectRoute(page) {
  return await page.evaluate(() => {
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
    const interactive = [...document.querySelectorAll("button,a,input,select,textarea,[role='button']")]
      .filter(visible)
      .filter((el) => !(typeof el.tabIndex === "number" && el.tabIndex < 0));
    const labelOf = (el) => (
      el.getAttribute("aria-label")
        || el.getAttribute("title")
        || el.textContent
        || el.getAttribute("href")
        || el.tagName
    ).trim().replace(/\s+/g, " ").slice(0, 96);
    const clippedInteractive = interactive
      .map((el) => ({ tag: el.tagName.toLowerCase(), label: labelOf(el), rect: rectOf(el) }))
      .filter((item) => item.rect.left < -2 || item.rect.right > window.innerWidth + 2)
      .slice(0, 20);
    const smallTapTargets = interactive
      .map((el) => ({ tag: el.tagName.toLowerCase(), label: labelOf(el), rect: rectOf(el) }))
      .filter((item) => item.label !== "Skip to content")
      .filter((item) => item.rect.width < 28 || item.rect.height < 28)
      .slice(0, 20);
    const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
    return {
      title: document.title,
      lang: document.documentElement.lang || null,
      dir: document.documentElement.dir || "ltr",
      h1Texts: [...document.querySelectorAll("h1")]
        .filter(visible)
        .map((el) => (el.textContent || "").trim().replace(/\s+/g, " "))
        .filter(Boolean),
      bodyTextChars: bodyText.length,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      clippedInteractive,
      smallTapTargets,
      fixedOverlays: [...document.querySelectorAll("body *")]
        .filter(visible)
        .filter((el) => window.getComputedStyle(el).position === "fixed")
        .map((el) => ({ tag: el.tagName.toLowerCase(), label: labelOf(el), rect: rectOf(el) }))
        .filter((item) => item.rect.width > 80 && item.rect.height > 40)
        .slice(0, 10),
    };
  });
}

function routePass(result) {
  const minBodyChars = result.route === "/auth/error" ? 100 : 200;
  return result.status >= 200
    && result.status < 400
    && result.metrics.h1Texts.length === 1
    && result.metrics.bodyTextChars > minBodyChars
    && !result.metrics.overflowX
    && result.metrics.clippedInteractive.length === 0
    && result.consoleErrors.length === 0;
}

async function main() {
  const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
  const inventoryPath = arg("inventory", path.join(ROOT, ".collab/tasks/qa-route-inventory-2026-05-10.json"));
  const jsonOut = arg("json-out", path.join(ROOT, ".collab/tasks/qa-public-mobile-pages-ux-2026-05-10.json"));
  const screenshotDir = arg("screenshot-dir", path.join(ROOT, ".collab/tasks/screenshots/2026-05-10/public-mobile"));
  const limit = Number(arg("limit", "0"));
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });

  const allRoutes = loadRoutes(inventoryPath);
  const routes = limit > 0 ? allRoutes.slice(0, limit) : allRoutes;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    isMobile: true,
  });

  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    inventory: inventoryPath,
    viewport: { width: 390, height: 844 },
    route_count: routes.length,
    routes: [],
  };

  try {
    for (const route of routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      let response = null;
      let metrics = null;
      let error = null;
      try {
        response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
        metrics = await inspectRoute(page);
      } catch (err) {
        error = err && err.stack ? err.stack : String(err);
        metrics = await inspectRoute(page).catch(() => null);
      }
      const result = {
        route,
        status: response ? response.status() : 0,
        final_url: page.url().replace(baseUrl, ""),
        metrics,
        consoleErrors,
        error,
      };
      result.result = !error && metrics && routePass(result) ? "pass" : "fail";
      if (result.result !== "pass") {
        const screenshot = path.join(screenshotDir, `${routeSlug(route)}.png`);
        await page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);
        result.screenshot = screenshot;
      }
      report.routes.push(result);
      await page.close();
    }
  } finally {
    await context.close();
    await browser.close();
  }

  report.summary = {
    pass: report.routes.filter((route) => route.result === "pass").length,
    fail: report.routes.filter((route) => route.result !== "pass").length,
    overflow: report.routes.filter((route) => route.metrics && route.metrics.overflowX).length,
    h1Issues: report.routes.filter((route) => route.metrics && route.metrics.h1Texts.length !== 1).length,
    consoleErrorRoutes: report.routes.filter((route) => route.consoleErrors.length > 0).length,
    clippedInteractiveRoutes: report.routes.filter(
      (route) => route.metrics && route.metrics.clippedInteractive.length > 0,
    ).length,
    smallTapTargetRoutes: report.routes.filter(
      (route) => route.metrics && route.metrics.smallTapTargets.length > 0,
    ).length,
  };
  report.result = report.summary.fail === 0 ? "pass" : "fail";
  fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PUBLIC_MOBILE_UX ${report.result.toUpperCase()}: ${report.summary.pass}/${report.route_count} routes`);
  if (report.result !== "pass") process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
