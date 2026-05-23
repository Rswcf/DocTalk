#!/usr/bin/env node
/* Browser UX checks for chat-native structured artifacts and collection templates. */

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
    domain: new URL(baseUrl).hostname,
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

async function waitForHighlight(page, snippet) {
  await page.waitForFunction((expected) => {
    return [...document.querySelectorAll("span")].some((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (el.textContent || "").includes(expected)
        && (el.getAttribute("class") || "").includes("bg-amber")
        && style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    });
  }, snippet, { timeout: 15000 });
}

async function layoutMetrics(page) {
  return await page.evaluate(() => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const overflowing = [...document.querySelectorAll("body *")]
      .filter(isVisible)
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > window.innerWidth + 2 || rect.left < -2;
      })
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        className: String(el.getAttribute("class") || "").slice(0, 160),
        right: Math.round(el.getBoundingClientRect().right),
      }))
      .slice(0, 8);
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      bodyText: document.body.innerText,
      artifactCards: [...document.querySelectorAll(".not-prose")]
        .filter(isVisible)
        .filter((el) => /Key Facts|Tables|Question template/i.test(el.textContent || ""))
        .length,
      buttons: [...document.querySelectorAll("button")]
        .filter(isVisible)
        .map((el) => (el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 80),
      overflowing,
    };
  });
}

async function readDownload(download) {
  const filePath = await download.path();
  const content = fs.readFileSync(filePath, "utf8");
  return {
    suggested_filename: download.suggestedFilename(),
    bytes: Buffer.byteLength(content),
    preview: content.slice(0, 600),
  };
}

async function downloadAnchor(page, selector) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.locator(selector).first().click(),
  ]);
  return readDownload(download);
}

async function fetchText(page, url) {
  return await page.evaluate(async (target) => {
    const res = await fetch(target);
    const text = await res.text();
    return {
      suggested_filename: "",
      status: res.status,
      bytes: new TextEncoder().encode(text).length,
      preview: text.slice(0, 600),
    };
  }, url);
}

async function downloadAnchorOrFetch(page, selector, useDownloadEvent) {
  const locator = page.locator(selector).first();
  if (useDownloadEvent) return downloadAnchor(page, selector);
  const href = await locator.getAttribute("href");
  if (!href) throw new Error(`Download link missing href for selector ${selector}`);
  return fetchText(page, href);
}

async function downloadButton(page, name) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("button", { name }).first().click(),
  ]);
  return readDownload(download);
}

async function downloadButtonOrFetch(page, name, fallbackUrl, useDownloadEvent) {
  if (useDownloadEvent) return downloadButton(page, name);
  await page.getByRole("button", { name }).first().click();
  return fetchText(page, fallbackUrl);
}

async function runDocumentArtifacts(page, fixture, baseUrl, useDownloadEvent) {
  await page.goto(`${baseUrl}/d/${fixture.document_id}`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /Structured tool results are ready/i);
  await waitForVisibleText(page, /Key Facts/i);
  await waitForVisibleText(page, /Tables/i);
  await waitForVisibleText(page, /Question template/i);
  await waitForVisibleText(page, /Revenue:\s*42/i);
  await waitForVisibleText(page, /Provider:\s*markdown/i);

  const extractionMd = await downloadAnchorOrFetch(
    page,
    `a[href*="/api/extractions/${fixture.extraction_job_id}/export?format=md"]`,
    useDownloadEvent,
  );
  const extractionCsv = await downloadAnchorOrFetch(
    page,
    `a[href*="/api/extractions/${fixture.extraction_job_id}/export?format=csv"]`,
    useDownloadEvent,
  );
  const tableCsv = await downloadAnchorOrFetch(
    page,
    `a[href*="/api/documents/${fixture.document_id}/tables/export"]`,
    useDownloadEvent,
  );
  const templateMd = await downloadAnchorOrFetch(
    page,
    `a[href*="/api/question-template-runs/${fixture.template_run_job_id}/export?format=md"]`,
    useDownloadEvent,
  );

  const beforeCitationMetrics = await layoutMetrics(page);
  await page.getByRole("button", { name: /^p\.1$/i }).first().click();
  await waitForHighlight(page, "Revenue is 42 in the synthetic structured workflow fixture.");

  return {
    before_citation_metrics: beforeCitationMetrics,
    metrics: await layoutMetrics(page),
    downloads: {
      extraction_md: extractionMd,
      extraction_csv: extractionCsv,
      table_csv: tableCsv,
      template_md: templateMd,
    },
  };
}

async function runCollectionTemplates(page, fixture, baseUrl, useDownloadEvent) {
  await page.goto(`${baseUrl}/collections/${fixture.collection_id}`, { waitUntil: "domcontentloaded" });
  await waitForVisibleText(page, /QA Structured Workflows Collection/i);
  await page.getByRole("button", { name: /^Templates$/i }).first().click();
  await waitForVisibleText(page, /Ask every document the same questions/i);
  await waitForVisibleText(page, /QA Revenue Checklist/i);
  await waitForVisibleText(page, /Revenue is 42/i);

  const runMd = await downloadButtonOrFetch(
    page,
    /^MD$/i,
    `/api/proxy/api/question-template-runs/${fixture.template_run_job_id}/export?format=md`,
    useDownloadEvent,
  );
  const runCsv = await downloadButtonOrFetch(
    page,
    /^CSV$/i,
    `/api/proxy/api/question-template-runs/${fixture.template_run_job_id}/export?format=csv`,
    useDownloadEvent,
  );

  await page.getByLabel(/Template name/i).fill("QA Browser Follow-up");
  await page.getByLabel(/Description/i).fill("Created by browser UX QA");
  await page.getByLabel(/Questions/i).fill("What is the revenue?\nWhat is the churn?");
  await page.getByRole("button", { name: /^Save template$/i }).click();
  await waitForVisibleText(page, /QA Browser Follow-up/i);
  await waitForVisibleText(page, /2 questions/i);

  await page.getByRole("button", { name: /^Edit$/i }).first().click();
  await page.getByLabel(/Template name/i).fill("QA Browser Follow-up Updated");
  await page.getByRole("button", { name: /^Update template$/i }).click();
  await waitForVisibleText(page, /QA Browser Follow-up Updated/i);

  const popupPromise = page.waitForEvent("popup", { timeout: 10000 }).catch(() => null);
  await page.getByRole("button", { name: /^p\.1$/i }).first().click();
  const popup = await popupPromise;
  const popupUrl = popup ? popup.url() : "";
  if (popup) await popup.close().catch(() => undefined);

  return {
    metrics: await layoutMetrics(page),
    downloads: {
      run_md: runMd,
      run_csv: runCsv,
    },
    popup_url: popupUrl,
  };
}

async function runViewport(browser, fixture, baseUrl, screenshotDir, name, viewportOptions) {
  const context = await browser.newContext({ ...viewportOptions, acceptDownloads: true });
  await context.addCookies([await makeCookie(fixture.user, baseUrl)]);
  const page = await context.newPage();
  const consoleErrors = attachConsole(page);

  const useDownloadEvent = !viewportOptions.isMobile;
  const documentArtifacts = await runDocumentArtifacts(page, fixture, baseUrl, useDownloadEvent);
  const documentScreenshot = path.join(screenshotDir, `structured-workflows-document-${name}.png`);
  await page.screenshot({ path: documentScreenshot, fullPage: false });

  const collectionTemplates = await runCollectionTemplates(page, fixture, baseUrl, useDownloadEvent);
  const collectionScreenshot = path.join(screenshotDir, `structured-workflows-collection-${name}.png`);
  await page.screenshot({ path: collectionScreenshot, fullPage: false });

  await context.close();
  return {
    document_artifacts: documentArtifacts,
    collection_templates: collectionTemplates,
    screenshots: {
      document: documentScreenshot,
      collection: collectionScreenshot,
    },
    console_errors: consoleErrors,
  };
}

function ok(view, fixture) {
  const documentText = view.document_artifacts.before_citation_metrics.bodyText;
  const collectionText = view.collection_templates.metrics.bodyText;
  const downloads = {
    ...view.document_artifacts.downloads,
    ...view.collection_templates.downloads,
  };
  return /Structured tool results are ready/i.test(documentText)
    && /Key Facts/i.test(documentText)
    && /Provider:\s*markdown/i.test(documentText)
    && /Question template/i.test(documentText)
    && /QA Revenue Checklist/i.test(collectionText)
    && /QA Browser Follow-up Updated/i.test(collectionText)
    && /Revenue is 42/i.test(collectionText)
    && /Revenue:\s*42/i.test(downloads.extraction_md.preview)
    && /Revenue/i.test(downloads.extraction_csv.preview)
    && /Metric,Value,Notes|Metric/.test(downloads.table_csv.preview)
    && /QA Revenue Checklist/i.test(downloads.template_md.preview)
    && /Revenue is 42/i.test(downloads.run_md.preview)
    && /Revenue is 42/i.test(downloads.run_csv.preview)
    && view.collection_templates.popup_url.includes(`/d/${fixture.document_id}`)
    && view.collection_templates.popup_url.includes(`highlight=${fixture.chunk_id}`)
    && !view.document_artifacts.before_citation_metrics.overflowX
    && !view.document_artifacts.metrics.overflowX
    && !view.collection_templates.metrics.overflowX
    && view.console_errors.length === 0;
}

async function main() {
  const fixturePath = arg("fixture", path.join(ROOT, ".collab/tasks/qa-browser-structured-workflows-fixture-2026-05-11.json"));
  const baseUrl = arg("base-url", "http://localhost:3000");
  const outPath = arg("json-out", path.join(ROOT, ".collab/tasks/qa-browser-structured-workflows-ux-2026-05-11.json"));
  const screenshotDir = path.join(ROOT, ".collab/tasks/screenshots/2026-05-11");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    fixture_path: fixturePath,
    document_id: fixture.document_id,
    collection_id: fixture.collection_id,
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
    );
  } finally {
    await browser.close();
  }

  const desktopOk = ok(report.desktop, fixture);
  const mobileOk = ok(report.mobile, fixture);
  report.result = desktopOk && mobileOk ? "pass" : "fail";
  report.summary = {
    desktop_ok: desktopOk,
    mobile_ok: mobileOk,
    desktop_console_errors: report.desktop.console_errors.length,
    mobile_console_errors: report.mobile.console_errors.length,
    desktop_document_overflow: report.desktop.document_artifacts.metrics.overflowX,
    mobile_document_overflow: report.mobile.document_artifacts.metrics.overflowX,
    desktop_collection_overflow: report.desktop.collection_templates.metrics.overflowX,
    mobile_collection_overflow: report.mobile.collection_templates.metrics.overflowX,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (report.result !== "pass") {
    console.error(`FAIL: structured workflow browser UX ${JSON.stringify(report.summary)}`);
    process.exit(1);
  }
  console.log(`PASS: structured workflow browser UX ${JSON.stringify(report.summary)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
