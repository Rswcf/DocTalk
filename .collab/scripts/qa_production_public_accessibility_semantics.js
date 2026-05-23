#!/usr/bin/env node
/* Production public-page accessibility and semantic UX audit. */

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
    .filter((route) => route.kind !== "auth")
    .filter((route) => !route.requires)
    .filter((route) => route.template !== "/demo/[sample]")
    .filter((route) => !route.route.includes("["))
    .map((route) => route.route)
    .sort();
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const textOf = (el) => (el.textContent || "").trim().replace(/\s+/g, " ");
    const visible = (el) => {
      if (el.closest("[aria-hidden='true']")) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && style.opacity !== "0"
        && rect.width > 0
        && rect.height > 0;
    };
    const selectorOf = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const classes = typeof el.className === "string"
        ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).map((item) => `.${item}`).join("")
        : "";
      return `${tag}${id}${classes}`;
    };
    const labelledByText = (el) => {
      const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      return ids
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map(textOf)
        .join(" ")
        .trim();
    };
    const explicitLabelText = (el) => {
      const labels = typeof el.labels !== "undefined" ? [...el.labels] : [];
      const forLabel = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
      const wrappingLabel = el.closest("label");
      return [...labels, forLabel, wrappingLabel]
        .filter(Boolean)
        .map(textOf)
        .join(" ")
        .trim();
    };
    const accessibleName = (el) => {
      if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
      const labelled = labelledByText(el);
      if (labelled) return labelled;
      const label = explicitLabelText(el);
      if (label) return label;
      if (el instanceof HTMLImageElement && el.getAttribute("alt")) return el.getAttribute("alt").trim();
      if (el.getAttribute("title")) return el.getAttribute("title").trim();
      if ("placeholder" in el && el.getAttribute("placeholder")) return el.getAttribute("placeholder").trim();
      return textOf(el);
    };
    const rectOf = (el) => {
      const rect = el.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const isFocusableCandidate = (el) => {
      if (el.hasAttribute("disabled")) return false;
      if (el.getAttribute("aria-disabled") === "true") return false;
      if (typeof el.tabIndex === "number" && el.tabIndex < 0) return false;
      return true;
    };

    const interactive = [...document.querySelectorAll("a[href],button,input,select,textarea,[role='button'],[role='link']")]
      .filter(visible)
      .filter(isFocusableCandidate);
    const unnamedInteractive = interactive
      .filter((el) => accessibleName(el).length === 0)
      .map((el) => ({
        selector: selectorOf(el),
        href: el.getAttribute("href") || null,
        role: el.getAttribute("role") || el.tagName.toLowerCase(),
        rect: rectOf(el),
      }));

    const controls = [...document.querySelectorAll("input,select,textarea")]
      .filter(visible)
      .filter((el) => (el.getAttribute("type") || "").toLowerCase() !== "hidden");
    const unlabeledControls = controls
      .filter((el) => {
        if (accessibleName(el).length > 0) return false;
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
        if (el.closest("label")) return false;
        return true;
      })
      .map((el) => ({ selector: selectorOf(el), type: el.getAttribute("type") || el.tagName.toLowerCase() }));

    const missingAltImages = [...document.querySelectorAll("img")]
      .filter(visible)
      .filter((el) => el.getAttribute("role") !== "presentation")
      .filter((el) => el.getAttribute("aria-hidden") !== "true")
      .filter((el) => !el.hasAttribute("alt"))
      .map((el) => ({ selector: selectorOf(el), src: el.getAttribute("src") || "" }));

    const unsafeBlankLinks = [...document.querySelectorAll("a[target='_blank']")]
      .filter(visible)
      .filter((el) => {
        const rel = new Set((el.getAttribute("rel") || "").toLowerCase().split(/\s+/).filter(Boolean));
        return !rel.has("noopener") || !rel.has("noreferrer");
      })
      .map((el) => ({ selector: selectorOf(el), href: el.getAttribute("href"), rel: el.getAttribute("rel") || "" }));

    const idCounts = new Map();
    [...document.querySelectorAll("[id]")].forEach((el) => {
      const id = el.getAttribute("id");
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    });
    const duplicateIds = [...idCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));

    const visibleHeadings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(visible)
      .map((el) => ({
        level: Number(el.tagName.slice(1)),
        text: textOf(el).slice(0, 120),
      }));
    const headingOrderIssues = [];
    for (let index = 1; index < visibleHeadings.length; index += 1) {
      const prev = visibleHeadings[index - 1];
      const current = visibleHeadings[index];
      if (current.level > prev.level + 1) {
        headingOrderIssues.push({ previous: prev, current });
      }
    }

    const mainLandmarks = [...document.querySelectorAll("main,[role='main']")].filter(visible);
    const skipLinks = [...document.querySelectorAll("a[href^='#']")]
      .filter((el) => (el.textContent || "").toLowerCase().includes("skip"))
      .map((el) => el.getAttribute("href"));

    return {
      title: document.title,
      lang: document.documentElement.lang || "",
      dir: document.documentElement.dir || "ltr",
      mainLandmarkCount: mainLandmarks.length,
      skipLinks,
      h1Texts: [...document.querySelectorAll("h1")].filter(visible).map(textOf).filter(Boolean),
      headingCount: visibleHeadings.length,
      headingOrderIssues,
      unnamedInteractive,
      unlabeledControls,
      missingAltImages,
      unsafeBlankLinks,
      duplicateIds,
      interactiveCount: interactive.length,
      controlCount: controls.length,
      imageCount: [...document.querySelectorAll("img")].filter(visible).length,
    };
  });
}

function routePass(item) {
  return item.status >= 200
    && item.status < 400
    && item.metrics
    && item.metrics.lang
    && item.metrics.mainLandmarkCount >= 1
    && item.metrics.h1Texts.length === 1
    && item.metrics.unnamedInteractive.length === 0
    && item.metrics.unlabeledControls.length === 0
    && item.metrics.missingAltImages.length === 0
    && item.metrics.unsafeBlankLinks.length === 0
    && item.metrics.duplicateIds.length === 0;
}

async function runViewport(browser, baseUrl, routes, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "en-US",
    isMobile: viewport.name === "mobile",
  });
  const results = [];
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
        metrics = await inspectPage(page);
      } catch (err) {
        error = err && err.stack ? err.stack : String(err);
        metrics = await inspectPage(page).catch(() => null);
      }

      const item = {
        route,
        viewport: viewport.name,
        status: response ? response.status() : 0,
        final_url: page.url().replace(baseUrl, ""),
        metrics,
        consoleErrors,
        error,
      };
      item.result = !error && routePass(item) ? "pass" : "fail";
      results.push(item);
      await page.close();
    }
  } finally {
    await context.close();
  }
  return results;
}

async function main() {
  const baseUrl = arg("base-url", "https://www.doctalk.site").replace(/\/$/, "");
  const inventoryPath = arg("inventory", path.join(ROOT, ".collab/tasks/qa-route-inventory-2026-05-10.json"));
  const jsonOut = arg("json-out", path.join(ROOT, ".collab/tasks/qa-production-public-accessibility-semantics-2026-05-11.json"));
  const limit = Number(arg("limit", "0"));
  const allRoutes = loadRoutes(inventoryPath);
  const routes = limit > 0 ? allRoutes.slice(0, limit) : allRoutes;
  const viewports = [
    { name: "desktop", width: 1366, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    inventory: inventoryPath,
    route_count: routes.length,
    viewports,
    results: [],
  };

  try {
    for (const viewport of viewports) {
      const results = await runViewport(browser, baseUrl, routes, viewport);
      report.results.push(...results);
    }
  } finally {
    await browser.close();
  }

  report.summary = {
    total_checks: report.results.length,
    passed: report.results.filter((item) => item.result === "pass").length,
    failed: report.results.filter((item) => item.result !== "pass").length,
    routes_with_failures: [...new Set(report.results.filter((item) => item.result !== "pass").map((item) => item.route))].length,
    unnamed_interactive: report.results.reduce((sum, item) => sum + (item.metrics?.unnamedInteractive?.length || 0), 0),
    unlabeled_controls: report.results.reduce((sum, item) => sum + (item.metrics?.unlabeledControls?.length || 0), 0),
    missing_alt_images: report.results.reduce((sum, item) => sum + (item.metrics?.missingAltImages?.length || 0), 0),
    unsafe_blank_links: report.results.reduce((sum, item) => sum + (item.metrics?.unsafeBlankLinks?.length || 0), 0),
    duplicate_ids: report.results.reduce((sum, item) => sum + (item.metrics?.duplicateIds?.length || 0), 0),
    heading_order_issue_routes: report.results.filter((item) => (item.metrics?.headingOrderIssues?.length || 0) > 0).length,
    console_error_routes: report.results.filter((item) => item.consoleErrors.length > 0).length,
  };
  report.result = report.summary.failed === 0 ? "pass" : "fail";
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `PRODUCTION_PUBLIC_ACCESSIBILITY_SEMANTICS ${report.result.toUpperCase()}: `
    + `${report.summary.passed}/${report.summary.total_checks} viewport-route checks passed`,
  );
  if (report.result !== "pass") {
    const failures = report.results.filter((item) => item.result !== "pass");
    for (const item of failures.slice(0, 30)) {
      const m = item.metrics || {};
      console.log(
        `FAIL ${item.viewport} ${item.route}: status=${item.status} `
        + `unnamed=${m.unnamedInteractive?.length || 0} `
        + `unlabeled=${m.unlabeledControls?.length || 0} `
        + `missingAlt=${m.missingAltImages?.length || 0} `
        + `unsafeBlank=${m.unsafeBlankLinks?.length || 0} `
        + `dupIds=${m.duplicateIds?.length || 0} `
        + `console=${item.consoleErrors.length}`,
      );
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
