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

// ── The citation field (slice 2) ─────────────────────────────────────────

const repoRoot = path.resolve(__dirname, '../..');
const stringLiterals = (code) =>
  [...code.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));

function fieldContent() {
  const code = read('components/landing/citationFieldContent.ts');
  const paraBlock = code.slice(code.indexOf('export const PARAGRAPHS'), code.indexOf('];', code.indexOf('export const PARAGRAPHS')));
  const citedBlock = code.slice(code.indexOf('export const CITED'));
  return { paragraphs: stringLiterals(paraBlock), cited: stringLiterals(citedBlock)[0] };
}

test('the hero document is verbatim page 1 of the finance seed PDF, and CITED is inside it', (t) => {
  const { paragraphs, cited } = fieldContent();
  assert.ok(paragraphs.length >= 10, `expected the page's paragraphs, got ${paragraphs.length}`);
  assert.ok(cited && cited.length > 40, 'CITED is missing');
  assert.equal(paragraphs.filter((p) => p.includes(cited)).length, 1, 'CITED must be one sentence inside exactly one paragraph');

  const { spawnSync } = require('node:child_process');
  const pdf = path.join(repoRoot, 'backend/seed_data/alphabet-earnings.pdf');
  const out = spawnSync('pdftotext', ['-f', '1', '-l', '1', pdf, '-'], { encoding: 'utf8' });
  if (out.error || out.status !== 0) {
    t.skip('pdftotext is not installed; the verbatim check needs it (brew install poppler)');
    return;
  }
  const normalise = (s) => s.replace(/\s+/g, ' ').trim();
  const page = normalise(out.stdout);
  for (const p of paragraphs) {
    assert.ok(page.includes(normalise(p)), `not verbatim on page 1: "${p.slice(0, 70)}…"`);
  }
});

test('the citation field takes every colour and font from the tokens', () => {
  const code = read('components/landing/CitationField.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /['"`]#[0-9a-f]{3,8}\b/i, 'hardcoded hex colour in CitationField');
  assert.doesNotMatch(code, /IBM Plex Sans|Geist|system-ui/, 'hardcoded font family in CitationField');
  for (const token of ['--ed-ink', '--ed-evidence', '--ed-evidence-soft']) {
    assert.ok(code.includes(`'${token}'`), `CitationField no longer reads ${token}`);
  }
});

test('the hero no longer carries the v0.31.0 product frame', () => {
  assert.equal(fs.existsSync(path.join(src, 'components/landing/ProductFrame.tsx')), false);
  const hero = read('components/landing/HeroSection.tsx');
  assert.doesNotMatch(hero, /ProductFrame/);
  assert.match(hero, /<CitationField\b/);
});

test('the answer card copy exists in all 11 locales', () => {
  // The card is real text in every locale; only the document behind it stays
  // English. The four frame keys change together whenever the sample changes
  // (see citationFieldContent.ts).
  const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
  const keys = ['landing.frame.question', 'landing.frame.answer', 'landing.frame.source', 'landing.frame.description', 'landing.frame.quoteFinder'];
  for (const locale of LOCALES) {
    const messages = JSON.parse(read(`i18n/locales/${locale}.json`));
    for (const key of keys) {
      assert.ok(typeof messages[key] === 'string' && messages[key].trim(), `${key} missing or empty in ${locale}.json`);
    }
  }
});
