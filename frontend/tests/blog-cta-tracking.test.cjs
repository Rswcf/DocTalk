const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

// Blog /demo links send landing_cta_clicked, so the traffic readout can count
// a listicle visitor at the CTA click, as it does for the home page (Fable
// ruling 2026-10-14, Q2).

function loadTs(relPath, stubs = {}) {
  const filename = path.resolve(__dirname, relPath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = mod.require.bind(mod);
  mod.require = (request) => (request in stubs ? stubs[request] : realRequire(request));
  mod._compile(compiled, filename);
  return mod.exports;
}

const BLOG_POST_CLIENT = path.resolve(__dirname, '../src/app/blog/[slug]/BlogPostClient.tsx');

test('isDemoHref matches the demo route and its sub-paths only', () => {
  const calls = [];
  const { isDemoHref } = loadTs('../src/lib/blogCta.ts', {
    './analytics': { trackEvent: (...args) => calls.push(args) },
  });
  for (const href of ['/demo', '/demo/alphabet-earnings', '/demo?ref=blog', '/demo#start']) {
    assert.equal(isDemoHref(href), true, href);
  }
  for (const href of ['/demonstrate', '/pricing', '/blog/demo', 'https://www.doctalk.site/demo', '', undefined]) {
    assert.equal(isDemoHref(href), false, String(href));
  }
  assert.equal(calls.length, 0);
});

test('trackBlogDemoClick sends the attributed CTA event with its source', () => {
  const calls = [];
  const { trackBlogDemoClick } = loadTs('../src/lib/blogCta.ts', {
    './analytics': { trackEvent: (...args) => calls.push(args) },
  });
  trackBlogDemoClick('blog_about');
  trackBlogDemoClick('blog_cta');
  trackBlogDemoClick('blog_inline');
  assert.deepEqual(calls, [
    ['landing_cta_clicked', { source: 'blog_about', reason: 'demo' }],
    ['landing_cta_clicked', { source: 'blog_cta', reason: 'demo' }],
    ['landing_cta_clicked', { source: 'blog_inline', reason: 'demo' }],
  ]);
  // The readout counts this event; it must stay in the attributed set.
  const { ATTRIBUTED_EVENTS } = loadTs('../src/lib/attribution.ts');
  assert.equal(ATTRIBUTED_EVENTS.has('landing_cta_clicked'), true);
});

test('every /demo link in the blog post template is tracked once per site', () => {
  const src = fs.readFileSync(BLOG_POST_CLIENT, 'utf8');
  for (const source of ['blog_about', 'blog_cta', 'blog_inline']) {
    const count = src.split(`trackBlogDemoClick('${source}')`).length - 1;
    assert.equal(count, 1, `${source} call sites`);
  }
  // Each hard-coded /demo Link carries a tracked onClick.
  const demoLinks = src.match(/<Link href="\/demo"[^\n]*/g) || [];
  assert.equal(demoLinks.length, 2);
  for (const tag of demoLinks) assert.match(tag, /onClick=\{\(\) => trackBlogDemoClick\('blog_(about|cta)'\)\}/);
  // Markdown links: only /demo hrefs are tracked, and the handler is set after
  // the spread props so react-markdown's props cannot replace it.
  assert.match(
    src,
    /\{\.\.\.props\}\s*onClick=\{isDemoHref\(href\) \? \(\) => trackBlogDemoClick\('blog_inline'\) : undefined\}/,
  );
});
