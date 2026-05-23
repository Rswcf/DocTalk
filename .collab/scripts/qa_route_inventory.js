#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'frontend', 'src', 'app');
const BLOG_DIR = path.join(ROOT, 'frontend', 'content', 'blog');

const BLOG_CATEGORIES = ['guides', 'comparisons', 'use-cases', 'product', 'ai-insights'];
const DEMO_SAMPLES = ['earnings', 'paper', 'court', '10k', 'contract', 'alphabet-earnings', 'attention-paper', 'court-filing'];

const GATED_PREFIXES = ['/admin', '/billing', '/collections', '/document-diff', '/profile'];
const APP_DYNAMIC_REQUIRES = {
  '/collections/[collectionId]': 'existing collection id owned by current user',
  '/d/[documentId]': 'existing document id or demo document id',
  '/shared/[token]': 'valid shared-session token',
};

function parseArgs(argv) {
  const args = {
    baseUrl: null,
    jsonOut: null,
    mdOut: null,
    includeGatedFetch: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--json-out') args.jsonOut = argv[++i];
    else if (arg === '--md-out') args.mdOut = argv[++i];
    else if (arg === '--include-gated-fetch') args.includeGatedFetch = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node .collab/scripts/qa_route_inventory.js [options]

Options:
  --base-url URL             Fetch concrete routes from a running app.
  --json-out PATH            Write JSON report.
  --md-out PATH              Write Markdown report.
  --include-gated-fetch      Fetch gated routes too; default records them without fetching.
`);
}

function walk(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

function pageFileToRoute(file) {
  const rel = path.relative(APP_DIR, path.dirname(file)).split(path.sep).join('/');
  if (rel === '') return '/';
  return `/${rel}`;
}

function routeKind(route) {
  if (route.includes('[')) return 'dynamic-template';
  if (GATED_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) return 'gated';
  if (route.startsWith('/blog')) return 'seo-content';
  if (
    route.startsWith('/features')
    || route.startsWith('/use-cases')
    || route.startsWith('/compare')
    || route.startsWith('/alternatives')
    || route.startsWith('/tools')
  ) return 'seo-public';
  if (['/auth', '/auth/error', '/auth/verify-request'].includes(route)) return 'auth';
  return 'public';
}

function routeArea(route) {
  const first = route.split('/').filter(Boolean)[0] || 'home';
  if (first === 'd') return 'reader';
  if (first === 'shared') return 'sharing';
  if (first === 'document-diff') return 'document-diff';
  return first;
}

function listBlogSlugs() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''))
    .sort();
}

function expandConcreteRoutes(template) {
  if (template === '/blog/[slug]') return listBlogSlugs().map((slug) => `/blog/${slug}`);
  if (template === '/blog/category/[category]') return BLOG_CATEGORIES.map((category) => `/blog/category/${category}`);
  if (template === '/demo/[sample]') return DEMO_SAMPLES.map((sample) => `/demo/${sample}`);
  return [];
}

function buildInventory() {
  const pageFiles = walk(APP_DIR, (file) => path.basename(file) === 'page.tsx').sort();
  const apiRouteFiles = walk(APP_DIR, (file) => path.basename(file) === 'route.ts').sort();
  const templates = pageFiles.map((file) => {
    const route = pageFileToRoute(file);
    return {
      route,
      file: path.relative(ROOT, file),
      area: routeArea(route),
      kind: routeKind(route),
      requires: APP_DYNAMIC_REQUIRES[route] || null,
    };
  });
  const apiRoutes = apiRouteFiles.map((file) => {
    const route = pageFileToRoute(file);
    return {
      route,
      file: path.relative(ROOT, file),
      area: routeArea(route),
      kind: 'api-route',
      requires: route.includes('[') ? 'path parameter and endpoint-specific auth/body' : null,
    };
  });

  const concrete = [];
  for (const item of templates) {
    if (!item.route.includes('[')) {
      concrete.push({ ...item, template: item.route });
      continue;
    }
    for (const route of expandConcreteRoutes(item.route)) {
      concrete.push({
        ...item,
        route,
        template: item.route,
        kind: routeKind(route),
        requires: null,
      });
    }
  }

  const dynamicTemplates = templates.filter((item) => item.route.includes('['));

  return {
    generatedAt: new Date().toISOString(),
    appDir: path.relative(ROOT, APP_DIR),
    counts: {
      pageFiles: pageFiles.length,
      apiRouteFiles: apiRouteFiles.length,
      templates: templates.length,
      concreteRoutes: concrete.length,
      dynamicTemplates: dynamicTemplates.length,
    },
    templates,
    apiRoutes,
    concrete,
    dynamicTemplates,
  };
}

function extractMeta(html) {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i)
    || firstMatch(html, /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["'][^>]*>/i);
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  return {
    title: cleanText(title),
    description: cleanText(description),
    canonical: cleanText(canonical),
    h1Count,
  };
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : '';
}

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function fetchRoutes(inventory, baseUrl, includeGatedFetch) {
  if (!baseUrl) return [];
  const base = baseUrl.replace(/\/$/, '');
  const results = [];
  for (const route of inventory.concrete) {
    if (!includeGatedFetch && route.kind === 'gated') {
      results.push({
        route: route.route,
        skipped: true,
        reason: 'gated route; rerun with --include-gated-fetch to fetch',
      });
      continue;
    }
    const url = `${base}${route.route}`;
    const started = Date.now();
    try {
      const res = await fetch(url, { redirect: 'manual' });
      const contentType = res.headers.get('content-type') || '';
      const html = contentType.includes('text/html') ? await res.text() : '';
      results.push({
        route: route.route,
        status: res.status,
        redirected: res.status >= 300 && res.status < 400,
        location: res.headers.get('location') || null,
        contentType,
        durationMs: Date.now() - started,
        ...extractMeta(html),
      });
    } catch (error) {
      results.push({
        route: route.route,
        error: String(error && error.message ? error.message : error),
        durationMs: Date.now() - started,
      });
    }
  }
  return results;
}

function summarizeFetch(fetchResults) {
  const fetched = fetchResults.filter((item) => !item.skipped);
  const fetchErrors = fetched.filter((item) => item.error);
  const badStatus = fetched.filter((item) => item.status && (item.status < 200 || item.status >= 400));
  const missingTitle = fetched.filter((item) => item.status === 200 && !item.title);
  const missingDescription = fetched.filter((item) => item.status === 200 && !item.description);
  const h1Issues = fetched.filter((item) => item.status === 200 && item.contentType && item.contentType.includes('text/html') && item.h1Count !== 1);
  return {
    fetched: fetched.length,
    skipped: fetchResults.length - fetched.length,
    fetchErrors: fetchErrors.map((item) => ({ route: item.route, error: item.error })),
    badStatus: badStatus.map((item) => ({ route: item.route, status: item.status })),
    missingTitle: missingTitle.map((item) => item.route),
    missingDescription: missingDescription.map((item) => item.route),
    h1Issues: h1Issues.map((item) => ({ route: item.route, h1Count: item.h1Count })),
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push(`# QA Route Inventory - ${report.generatedAt.slice(0, 10)}`);
  lines.push('');
  lines.push(`App dir: \`${report.appDir}\``);
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|---|---:|');
  for (const [key, value] of Object.entries(report.counts)) {
    lines.push(`| ${key} | ${value} |`);
  }
  lines.push('');

  if (report.fetchSummary) {
    lines.push('## Fetch Summary');
    lines.push('');
    lines.push(`Fetched: ${report.fetchSummary.fetched}; skipped: ${report.fetchSummary.skipped}`);
    lines.push('');
    lines.push('| Check | Count |');
    lines.push('|---|---:|');
    lines.push(`| Fetch errors | ${report.fetchSummary.fetchErrors.length} |`);
    lines.push(`| Bad status | ${report.fetchSummary.badStatus.length} |`);
    lines.push(`| Missing title | ${report.fetchSummary.missingTitle.length} |`);
    lines.push(`| Missing description | ${report.fetchSummary.missingDescription.length} |`);
    lines.push(`| H1 issues | ${report.fetchSummary.h1Issues.length} |`);
    lines.push('');
  }

  lines.push('## Concrete Routes');
  lines.push('');
  lines.push('| Route | Kind | Area | Template |');
  lines.push('|---|---|---|---|');
  for (const item of report.concrete) {
    lines.push(`| \`${item.route}\` | ${item.kind} | ${item.area} | \`${item.template}\` |`);
  }
  lines.push('');

  lines.push('## Dynamic Templates Requiring Fixtures');
  lines.push('');
  lines.push('| Template | Area | Fixture Requirement |');
  lines.push('|---|---|---|');
  for (const item of report.dynamicTemplates.filter((route) => route.requires)) {
    lines.push(`| \`${item.route}\` | ${item.area} | ${item.requires} |`);
  }
  lines.push('');

  lines.push('## API Routes');
  lines.push('');
  lines.push('| Route | Area | File | Fixture Requirement |');
  lines.push('|---|---|---|---|');
  for (const item of report.apiRoutes) {
    lines.push(`| \`${item.route}\` | ${item.area} | \`${item.file}\` | ${item.requires || ''} |`);
  }
  lines.push('');

  if (report.fetchResults && report.fetchResults.length > 0) {
    lines.push('## Fetch Results');
    lines.push('');
    lines.push('| Route | Status | H1 | Title | Notes |');
    lines.push('|---|---:|---:|---|---|');
    for (const item of report.fetchResults) {
      const notes = item.skipped ? item.reason : (item.error || item.location || '');
      lines.push(`| \`${item.route}\` | ${item.status || ''} | ${item.h1Count ?? ''} | ${escapePipes(item.title || '')} | ${escapePipes(notes || '')} |`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function escapePipes(value) {
  return String(value).replace(/\|/g, '\\|');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inventory = buildInventory();
  const fetchResults = await fetchRoutes(inventory, args.baseUrl, args.includeGatedFetch);
  const report = {
    ...inventory,
    fetchBaseUrl: args.baseUrl,
    fetchResults,
    fetchSummary: fetchResults.length ? summarizeFetch(fetchResults) : null,
  };

  if (args.jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(args.jsonOut)), { recursive: true });
    fs.writeFileSync(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (args.mdOut) {
    fs.mkdirSync(path.dirname(path.resolve(args.mdOut)), { recursive: true });
    fs.writeFileSync(args.mdOut, toMarkdown(report));
  }

  if (!args.jsonOut && !args.mdOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Route inventory: ${report.counts.concreteRoutes} concrete routes, ${report.counts.dynamicTemplates} dynamic templates.`);
    if (report.fetchSummary) {
      console.log(`Fetched ${report.fetchSummary.fetched}; fetch errors ${report.fetchSummary.fetchErrors.length}; bad status ${report.fetchSummary.badStatus.length}; H1 issues ${report.fetchSummary.h1Issues.length}.`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
