const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// Night landing (plan .collab/plans/2026-09-21-landing-night.md). The landing
// root is `.dt-editorial.dt-night`: the editorial dark theme in BOTH OS themes.
// It must stay the SAME value set as `.dark .dt-editorial`, never a second one,
// and chrome rendered outside the root must follow it.

const src = path.resolve(__dirname, '../src');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');
const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('every .dark .dt-editorial selector has a .dt-editorial.dt-night twin in the same list', () => {
  const css = stripCssComments(read('app/editorial.css'));
  const preludes = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1]);
  let darkSelectors = 0;
  for (const prelude of preludes) {
    const list = prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    for (const selector of list) {
      if (!selector.startsWith('.dark .dt-editorial')) continue;
      darkSelectors += 1;
      const twin = selector.replace('.dark .dt-editorial', '.dt-editorial.dt-night');
      assert.ok(list.includes(twin), `"${selector}" has no "${twin}" twin in the same selector list`);
    }
  }
  assert.ok(darkSelectors >= 2, 'expected the dark token set and the dark grain at least');
});

test('the night twin never carries values of its own', () => {
  // A standalone `.dt-editorial.dt-night { ... }` block would be a second
  // value set that drifts from the dark one. Twins only appear in lists.
  const css = stripCssComments(read('app/editorial.css'));
  const preludes = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim().replace(/\s+/g, ' '));
  for (const prelude of preludes) {
    const list = prelude.split(',').map((s) => s.trim());
    const night = list.filter((s) => s.startsWith('.dt-editorial.dt-night'));
    for (const selector of night) {
      const dark = selector.replace('.dt-editorial.dt-night', '.dark .dt-editorial');
      assert.ok(list.includes(dark), `"${selector}" is styled without its "${dark}" original`);
    }
  }
});

test('the landing root is Night', () => {
  assert.match(read('components/landing/LandingPageContent.tsx'), /className="dt-editorial dt-night"/);
});

test('chrome rendered outside the landing root mirrors Night', () => {
  // Both render outside the page root (the banner is a sibling of
  // #page-content; the language menu is portalled to <body>), so neither can
  // inherit the class and each must look for it.
  assert.match(read('components/CookieConsentBanner.tsx'), /dt-night/);
  assert.match(read('components/marketing/EdLanguageSelector.tsx'), /closest\(["']\.dt-night["']\)/);
});
