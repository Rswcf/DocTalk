#!/usr/bin/env node
/* Browser UX checks for public /tools utilities on production. */

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
  const networkRequests = [];
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
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      resource_type: request.resourceType(),
    });
  });
  return { consoleErrors, pageErrors, failedRequests, networkRequests };
}

async function commonMetrics(page) {
  return page.evaluate(() => {
    const clippedInteractive = [...document.querySelectorAll("button, a, input, textarea, select")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = el.getAttribute("aria-label")
          || el.getAttribute("id")
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
      bodyTextChars: (document.body.innerText || "").replace(/\s+/g, " ").trim().length,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      clippedInteractive,
    };
  });
}

async function collectWordStats(page) {
  return page.evaluate(() => {
    const stats = {};
    for (const row of document.querySelectorAll("dl div")) {
      const key = row.querySelector("dt")?.textContent?.trim();
      const value = row.querySelector("dd")?.textContent?.trim();
      if (key && value) stats[key] = value;
    }
    const topHeading = [...document.querySelectorAll("h2")]
      .find((el) => /top 10 most frequent words/i.test(el.textContent || ""));
    const topWords = topHeading?.nextElementSibling
      ? [...topHeading.nextElementSibling.children]
        .map((card) => {
          const compact = (card.textContent || "").replace(/\s+/g, " ").trim();
          const match = compact.match(/^\d+\.\s*([^\d]+?)\s*\d+x$/i);
          return (match ? match[1] : compact).trim();
        })
        .filter(Boolean)
      : [];
    return {
      textareaValue: document.querySelector("#word-counter-input")?.value || "",
      stats,
      topWords,
      averageReadCard: [...document.querySelectorAll("p")]
        .find((el) => el.textContent?.trim() === "Average read")
        ?.parentElement?.querySelector("p:last-child")?.textContent?.trim() || "",
      copyButtonText: [...document.querySelectorAll("button")]
        .map((button) => button.textContent?.trim())
        .find((text) => text === "Copy" || text === "Copied") || "",
      clearButtonVisible: [...document.querySelectorAll("button")]
        .some((button) => button.textContent?.trim() === "Clear"),
    };
  });
}

async function collectReadingTime(page) {
  return page.evaluate(() => {
    const cards = {};
    for (const card of document.querySelectorAll("section .grid > div")) {
      const label = card.querySelector("p")?.textContent?.trim();
      const value = card.querySelector("p:nth-of-type(2)")?.textContent?.trim();
      if (label && value) cards[label] = value;
    }
    const rows = {};
    for (const row of document.querySelectorAll("div.space-y-4 > div")) {
      const label = row.querySelector("span")?.textContent?.trim();
      const value = row.querySelector("span.min-w-\\[5rem\\]")?.textContent?.trim();
      if (label && value) rows[label] = value;
    }
    return {
      textareaValue: document.querySelector("#reading-time-input")?.value || "",
      cards,
      rows,
      wordLine: [...document.querySelectorAll("p")]
        .map((p) => p.textContent?.trim())
        .find((text) => /\d[\d,]* words?$/.test(text || "")) || "",
      clearButtonVisible: [...document.querySelectorAll("button")]
        .some((button) => button.textContent?.trim() === "Clear"),
    };
  });
}

async function runToolsHub(page, baseUrl) {
  const response = await page.goto(`${baseUrl}/tools`, { waitUntil: "networkidle", timeout: 35000 });
  await page.getByRole("heading", { name: /document tools/i }).waitFor({ timeout: 30000 });
  const metrics = await commonMetrics(page);
  const wordCounterLink = page.getByRole("link", { name: /word counter/i }).first();
  const readingTimeLink = page.getByRole("link", { name: /reading time calculator/i }).first();
  return {
    name: "tools_hub_links",
    status: response ? response.status() : null,
    metrics,
    assertions: {
      page_loaded: response && response.status() >= 200 && response.status() < 400,
      h1_mentions_tools: /document tools/i.test(metrics.h1),
      word_counter_link_visible: await wordCounterLink.isVisible().catch(() => false),
      reading_time_link_visible: await readingTimeLink.isVisible().catch(() => false),
      no_horizontal_overflow: !metrics.overflowX,
      no_clipped_interactive: metrics.clippedInteractive.length === 0,
    },
  };
}

async function runWordCounter(page, baseUrl) {
  const response = await page.goto(`${baseUrl}/tools/word-counter`, { waitUntil: "networkidle", timeout: 35000 });
  await page.getByRole("heading", { name: /free document word counter/i, level: 1 }).waitFor({ timeout: 30000 });
  const metricsBefore = await commonMetrics(page);
  const textarea = page.locator("#word-counter-input");
  const customText = "Alpha beta beta.\n\nGamma delta alpha!";
  await textarea.fill(customText);
  await page.waitForTimeout(250);
  const custom = await collectWordStats(page);

  await page.getByRole("button", { name: /copy/i }).click();
  await page.getByRole("button", { name: /copied/i }).waitFor({ timeout: 3000 });
  const afterCopy = await collectWordStats(page);

  await page.getByRole("button", { name: /clear/i }).click();
  await page.waitForTimeout(150);
  const afterClear = await collectWordStats(page);

  await page.getByRole("button", { name: /sample/i }).click();
  await page.waitForTimeout(150);
  const afterSample = await collectWordStats(page);
  const metricsAfter = await commonMetrics(page);

  return {
    name: "word_counter_interaction",
    status: response ? response.status() : null,
    metrics_before: metricsBefore,
    metrics_after: metricsAfter,
    custom,
    after_copy: afterCopy,
    after_clear: afterClear,
    after_sample: afterSample,
    assertions: {
      page_loaded: response && response.status() >= 200 && response.status() < 400,
      h1_mentions_word_counter: /word counter/i.test(metricsBefore.h1),
      custom_word_count_correct: custom.stats.Words === "6",
      custom_characters_present: custom.stats.Characters === String(customText.length),
      custom_sentences_correct: custom.stats.Sentences === "2",
      custom_paragraphs_correct: custom.stats.Paragraphs === "2",
      custom_top_words_include_alpha_beta: custom.topWords.includes("alpha") && custom.topWords.includes("beta"),
      copy_feedback_visible: afterCopy.copyButtonText === "Copied",
      clear_resets_text: afterClear.textareaValue === "" && afterClear.stats.Words === "0",
      sample_populates_text: afterSample.textareaValue.length > 100 && Number(afterSample.stats.Words) > 20,
      no_horizontal_overflow: !metricsAfter.overflowX,
      no_clipped_interactive: metricsAfter.clippedInteractive.length === 0,
    },
  };
}

async function runReadingTime(page, baseUrl) {
  const response = await page.goto(`${baseUrl}/tools/reading-time`, { waitUntil: "networkidle", timeout: 35000 });
  await page.getByRole("heading", { name: /reading time calculator/i, level: 1 }).waitFor({ timeout: 30000 });
  const metricsBefore = await commonMetrics(page);
  const words = Array.from({ length: 300 }, (_, i) => `word${i + 1}`).join(" ");
  const textarea = page.locator("#reading-time-input");
  await textarea.fill(words);
  await page.waitForTimeout(250);
  const custom = await collectReadingTime(page);

  await page.getByRole("button", { name: /clear/i }).click();
  await page.waitForTimeout(150);
  const afterClear = await collectReadingTime(page);

  await page.getByRole("button", { name: /sample/i }).click();
  await page.waitForTimeout(150);
  const afterSample = await collectReadingTime(page);
  const metricsAfter = await commonMetrics(page);

  return {
    name: "reading_time_interaction",
    status: response ? response.status() : null,
    metrics_before: metricsBefore,
    metrics_after: metricsAfter,
    custom,
    after_clear: afterClear,
    after_sample: afterSample,
    assertions: {
      page_loaded: response && response.status() >= 200 && response.status() < 400,
      h1_mentions_reading_time: /reading time/i.test(metricsBefore.h1),
      custom_word_count_correct: custom.wordLine === "300 words" || custom.cards.Words === "300",
      average_reading_correct: custom.cards["Average reading"] === "2 min",
      average_speaking_correct: custom.cards["Average speaking"] === "2 min",
      silent_average_row_correct: custom.rows["Average reader"] === "2 min",
      speaking_average_row_correct: custom.rows["Average (conversational)"] === "2 min",
      clear_resets_text: afterClear.textareaValue === "" && (afterClear.wordLine === "0 words" || afterClear.cards.Words === "0"),
      sample_populates_text: afterSample.textareaValue.length > 100 && !["0 words", ""].includes(afterSample.wordLine),
      no_horizontal_overflow: !metricsAfter.overflowX,
      no_clipped_interactive: metricsAfter.clippedInteractive.length === 0,
    },
  };
}

async function runViewport(browser, baseUrl, viewport, screenshotDir) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: "en-US",
    permissions: ["clipboard-write"],
  });
  const page = await context.newPage();
  const observers = attachObservers(page);
  const result = {
    viewport: viewport.name,
    scenarios: [],
    console_errors: observers.consoleErrors,
    page_errors: observers.pageErrors,
    failed_requests: observers.failedRequests,
    result: "fail",
    screenshot: null,
  };
  try {
    result.scenarios.push(await runToolsHub(page, baseUrl));
    result.scenarios.push(await runWordCounter(page, baseUrl));
    result.scenarios.push(await runReadingTime(page, baseUrl));
  } catch (err) {
    result.error = err && err.stack ? err.stack : String(err);
  }
  result.assertions = {
    scenarios_pass: result.scenarios.every((scenario) => Object.values(scenario.assertions).every(Boolean)),
    no_console_errors: observers.consoleErrors.length === 0,
    no_page_errors: observers.pageErrors.length === 0,
    no_failed_requests: observers.failedRequests.length === 0,
    no_non_auth_api_requests: observers.networkRequests
      .filter((request) => request.url.includes(`${baseUrl}/api/`))
      .filter((request) => !request.url.includes(`${baseUrl}/api/auth/`))
      .length === 0,
  };
  result.result = Object.values(result.assertions).every(Boolean) ? "pass" : "fail";
  if (result.result !== "pass") {
    const screenshot = path.join(screenshotDir, `production-tools-ux-${viewport.name}-failure.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    result.screenshot = path.relative(ROOT, screenshot);
  }
  await context.close();
  return result;
}

async function main() {
  const baseUrl = arg("base-url", "https://www.doctalk.site").replace(/\/$/, "");
  const jsonOut = arg("json-out", ".collab/tasks/qa-production-tools-ux-2026-05-11.json");
  const screenshotDir = path.resolve(ROOT, arg("screenshot-dir", ".collab/tasks/screenshots/2026-05-11/production-tools-ux"));
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: "desktop", width: 1440, height: 900, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true },
  ];
  const report = {
    run: "qa-production-tools-ux",
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    safety_note: "Tools process user text in browser only; harness asserts no backend API requests during interactions.",
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
    scenarios: report.results.reduce((sum, item) => sum + item.scenarios.length, 0),
  };
  report.result = report.summary.failed === 0 ? "pass" : "fail";
  const out = path.resolve(ROOT, jsonOut);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PRODUCTION_TOOLS_UX ${report.result.toUpperCase()}: ${report.summary.passed}/${report.summary.total} viewports passed`);
  if (report.result !== "pass") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
