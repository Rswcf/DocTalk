const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const src = path.resolve(__dirname, '../src');
const cache = new Map();

// Execute the real sitemap module and its real routing/blog dependencies, so the
// assertions below are about shipped behaviour rather than a restated constant.
function loadSource(relativePath) {
  const filename = path.resolve(src, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, loaded);
  loaded.require = function requireSource(request) {
    if (request.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), request);
      for (const extension of ['.ts', '.tsx']) {
        if (fs.existsSync(target + extension)) return loadSource(target + extension);
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        for (const extension of ['.ts', '.tsx']) {
          const index = path.join(target, `index${extension}`);
          if (fs.existsSync(index)) return loadSource(index);
        }
      }
    }
    return Module.prototype.require.call(this, request);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}

const { LOCALIZED_PATHS, URL_LOCALES, NOINDEX_SUBPAGE_LOCALES } = loadSource('i18n/routing.ts');
const sitemap = loadSource('app/sitemap.ts').default;
const entries = sitemap();
const BASE = 'https://www.doctalk.site';
const urls = entries.map((entry) => entry.url);
const urlSet = new Set(urls);

// Index tiers (traffic plan v2, Step 4, 2026-10-10): for these locales only the
// home page is indexable. Restated here on purpose, so changing the tier set is a
// deliberate edit in two places, not a silent one.
const TIER2 = ['it', 'ar', 'hi'];
const indexable = (locale, localizedPath) => !TIER2.includes(locale) || localizedPath === '/';
const localeUrl = (locale, localizedPath) => (localizedPath === '/' ? `${BASE}/${locale}` : `${BASE}/${locale}${localizedPath}`);

/** Every directory under app/[locale] that is a real page route. */
function localeRouteDirs() {
  const root = path.join(src, 'app', '[locale]');
  const found = [];
  const walk = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.name === 'page.tsx') {
        const rel = path.relative(root, dir).split(path.sep).join('/');
        found.push(rel === '' ? '/' : `/${rel}`);
      }
    }
  };
  walk(root);
  return found;
}

test('every localized path has an English sitemap entry', () => {
  for (const localizedPath of LOCALIZED_PATHS) {
    const expected = localizedPath === '/' ? BASE : `${BASE}${localizedPath}`;
    assert.ok(
      urlSet.has(expected),
      `${localizedPath} is in LOCALIZED_PATHS but has no English sitemap entry — `
        + 'this is the defect that hid /features/layout-translation and /trust',
    );
  }
});

test('the tier-2 locale set is it, ar and hi', () => {
  assert.deepEqual([...NOINDEX_SUBPAGE_LOCALES].sort(), [...TIER2].sort());
  for (const locale of TIER2) assert.ok(URL_LOCALES.includes(locale), `${locale} is not a URL locale`);
});

test('every localized path has one entry per indexable URL locale, and none for tier-2 sub-pages', () => {
  for (const localizedPath of LOCALIZED_PATHS) {
    for (const locale of URL_LOCALES) {
      const expected = localeUrl(locale, localizedPath);
      if (indexable(locale, localizedPath)) {
        assert.ok(urlSet.has(expected), `missing locale sitemap entry: ${expected}`);
      } else {
        assert.ok(!urlSet.has(expected), `noindex tier-2 page listed in the sitemap: ${expected}`);
      }
    }
  }
  // The tier-2 home pages stay listed.
  for (const locale of TIER2) assert.ok(urlSet.has(`${BASE}/${locale}`), `missing tier-2 home page: ${locale}`);
});

test('LOCALIZED_PATHS and app/[locale] page routes agree in both directions', () => {
  const routes = new Set(localeRouteDirs());
  for (const localizedPath of LOCALIZED_PATHS) {
    assert.ok(routes.has(localizedPath), `${localizedPath} is in LOCALIZED_PATHS but has no app/[locale] page`);
  }
  for (const route of routes) {
    assert.ok(LOCALIZED_PATHS.has(route), `app/[locale]${route} exists but is not in LOCALIZED_PATHS`);
  }
});

// The root's hreflang map says `https://www.doctalk.site/` while its sitemap entry
// says `https://www.doctalk.site`. Those are the same URL (RFC 3986 6.2.3: an empty
// path is equivalent to "/"), and the trailing-slash form is what every page's own
// canonical and hreflang already emit via `absoluteUrl`. Compare normalized rather
// than changing either side and creating a real divergence.
const sameUrl = (a, b) => a?.replace(/\/$/, '') === b?.replace(/\/$/, '');

test('every localized English entry carries a reciprocal hreflang map', () => {
  for (const localizedPath of LOCALIZED_PATHS) {
    const expected = localizedPath === '/' ? BASE : `${BASE}${localizedPath}`;
    const entry = entries.find((candidate) => candidate.url === expected);
    const languages = entry?.alternates?.languages ?? {};
    assert.ok(sameUrl(languages.en, expected), `${localizedPath}: en hreflang must point at the English URL`);
    assert.ok(sameUrl(languages['x-default'], expected), `${localizedPath}: x-default must point at the English URL`);
    for (const locale of URL_LOCALES) {
      if (indexable(locale, localizedPath)) {
        assert.ok(sameUrl(languages[locale], localeUrl(locale, localizedPath)), `${localizedPath}: ${locale} hreflang`);
      } else {
        assert.equal(languages[locale], undefined, `${localizedPath}: noindex ${locale} page must not be an hreflang alternate`);
      }
    }
  }
});

test('every locale sitemap entry carries the same hreflang map as its English entry', () => {
  for (const localizedPath of LOCALIZED_PATHS) {
    const english = entries.find((candidate) => candidate.url === (localizedPath === '/' ? BASE : `${BASE}${localizedPath}`));
    for (const locale of URL_LOCALES) {
      const entry = entries.find((candidate) => candidate.url === localeUrl(locale, localizedPath));
      if (!entry) continue;
      assert.deepEqual(entry.alternates?.languages, english.alternates?.languages, `${locale}${localizedPath}`);
      // Every URL an hreflang map names is itself listed (no alternate points at a noindex page).
      for (const alternate of Object.values(entry.alternates.languages)) {
        assert.ok([...urlSet].some((url) => sameUrl(url, alternate)), `${localizedPath}: hreflang names an unlisted URL ${alternate}`);
      }
    }
  }
});

test('page metadata: tier-2 sub-pages are noindex,follow; every other page keeps its default robots', () => {
  const { buildMarketingMetadata } = loadSource('lib/seo.ts');
  const meta = (locale, localizedPath) => buildMarketingMetadata({
    title: 'T', description: 'D', path: localizedPath, locale, localized: true,
  });
  for (const localizedPath of LOCALIZED_PATHS) {
    for (const locale of ['en', ...URL_LOCALES]) {
      const result = meta(locale, localizedPath);
      if (indexable(locale, localizedPath)) {
        assert.equal(result.robots, undefined, `${locale}${localizedPath} must not override robots`);
      } else {
        assert.deepEqual(result.robots, { index: false, follow: true }, `${locale}${localizedPath}`);
      }
      // Canonical stays self-referencing on every page, noindex ones included.
      assert.equal(result.alternates.canonical, locale === 'en' ? localizedPath : localeUrl(locale, localizedPath).slice(BASE.length));
      const languages = result.alternates.languages;
      for (const other of TIER2) {
        assert.equal(other in languages, localizedPath === '/', `${locale}${localizedPath}: hreflang ${other}`);
      }
    }
  }
  // An explicit robots value from the caller still wins.
  const explicit = buildMarketingMetadata({
    title: 'T', description: 'D', path: '/pricing', locale: 'it', localized: true, robots: { index: true, follow: true },
  });
  assert.deepEqual(explicit.robots, { index: true, follow: true });
});

test('no sitemap URL is emitted twice', () => {
  const seen = new Set();
  const duplicates = urls.filter((url) => (seen.has(url) ? true : (seen.add(url), false)));
  assert.deepEqual(duplicates, [], `duplicate sitemap URLs: ${duplicates.join(', ')}`);
});

test('every localized path has an explicit priority (none falls back to the default)', () => {
  const source = fs.readFileSync(path.join(src, 'app', 'sitemap.ts'), 'utf8');
  const block = source.match(/const LOCALIZED_PRIORITY[^{]*\{([\s\S]*?)\n\};/);
  assert.ok(block, 'LOCALIZED_PRIORITY map not found in sitemap.ts');
  const mapped = new Set([...block[1].matchAll(/"([^"]+)":/g)].map((match) => match[1]));
  for (const localizedPath of LOCALIZED_PATHS) {
    assert.ok(mapped.has(localizedPath), `${localizedPath} has no explicit entry in LOCALIZED_PRIORITY`);
  }
  for (const mappedPath of mapped) {
    assert.ok(LOCALIZED_PATHS.has(mappedPath), `LOCALIZED_PRIORITY has a stale path: ${mappedPath}`);
  }
});

test('blog posts and categories are present', () => {
  const { getAllPosts, KNOWN_BLOG_CATEGORIES } = loadSource('lib/blog.ts');
  for (const post of getAllPosts()) {
    assert.ok(urlSet.has(`${BASE}/blog/${post.slug}`), `missing blog post: ${post.slug}`);
  }
  for (const category of KNOWN_BLOG_CATEGORIES) {
    assert.ok(urlSet.has(`${BASE}/blog/category/${category}`), `missing blog category: ${category}`);
  }
});
