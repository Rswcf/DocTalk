// Product vignettes (plan .collab/plans/2026-11-22-ui-ux-pangram-learnings.md
// M4/M5/M7) and the last-free-question notice (A2).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
require('./_load-ts.cjs');

const SRC = path.resolve(__dirname, '../src');
const src = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
function loadTsx(relative) {
  const filename = path.join(SRC, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const V = loadTsx('components/marketing/ProductVignettes.tsx');
const { CITED } = require('../src/components/landing/citationFieldContent.ts');
const { UPLOAD_EXTENSIONS } = require('../src/lib/uploadFormats.ts');
const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const frame = { question: 'Q?', answer: 'A.', source: 'Source, p. 1' };

test('vignettes are pure: no client directive, no hooks (server feature pages render them)', () => {
  const code = src('components/marketing/ProductVignettes.tsx');
  assert.doesNotMatch(code, /^["']use client["']/m);
  assert.doesNotMatch(code, /\buse(State|Effect|LayoutEffect|Locale|Ref|Memo|Callback|Id)\(/);
});

test('every vignette is an illustration: aria-hidden, nothing focusable', () => {
  const rendered = [
    React.createElement(V.AnswerVignette, frame),
    React.createElement(V.PassageVignette, { pageLabel: 'Page 1' }),
    React.createElement(V.LanguagesVignette, { ...frame, locale: 'de' }),
    React.createElement(V.TranslationVignette, { originalLabel: 'O', translatedLabel: 'T' }),
    React.createElement(V.FormatsVignette, { dropLabel: 'Drop' }),
  ].map((el) => renderToStaticMarkup(el));
  for (const html of rendered) {
    assert.match(html, /^<div class="ed-vignette[^"]*" aria-hidden="true">/);
    assert.doesNotMatch(html, /<(a|button|input|textarea|select)\b|tabindex/);
  }
});

test('the passage quotes the cited sentence verbatim, left-to-right English', () => {
  const html = renderToStaticMarkup(React.createElement(V.PassageVignette, { pageLabel: 'Page 1' }));
  const escaped = CITED.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  assert.ok(html.includes(`<mark class="ed-vignette-mark">${escaped}</mark>`));
  assert.match(html, /class="ed-vignette-passage" dir="ltr" lang="en"/);
});

test('format chips are the upload list plus URL, and still number seven (the proof strip says 7)', () => {
  assert.deepEqual(V.VIGNETTE_FORMATS, [...UPLOAD_EXTENSIONS.map((e) => e.slice(1).toUpperCase()), 'URL']);
  assert.equal(V.VIGNETTE_FORMATS.length, 7);
});

test("the language vignette always shows and selects the reader's own language", () => {
  for (const locale of LOCALES) {
    const langs = V.vignetteLanguages(locale);
    assert.equal(langs.length, 4);
    assert.ok(langs.some((l) => l.code === locale), `${locale} missing`);
    const html = renderToStaticMarkup(React.createElement(V.LanguagesVignette, { ...frame, locale }));
    assert.match(html, new RegExp(`lang="${locale}" class="ed-vignette-pill is-active"`));
  }
});

test('vignette styles stay at 12px and up, ink-3 at 13px and up, and scoped', () => {
  const css = src('app/editorial.css');
  const block = css.slice(css.indexOf('/* ─── Product vignettes'), css.indexOf('/* ─── Night hero'));
  assert.ok(block.length > 200);
  for (const [, size] of block.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size) >= 12, `font-size ${size}px`);
  for (const rule of block.split('}')) {
    const sel = rule.slice(0, rule.indexOf('{')).trim().replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!sel || sel.startsWith('@media')) continue;
    for (const part of sel.split(',').map((x) => x.trim()).filter(Boolean)) {
      assert.ok(part.startsWith('.dt-editorial ') || part.startsWith('@'), `unscoped selector: ${part}`);
    }
    if (/color:\s*var\(--ed-ink-3\)/.test(rule)) {
      const size = Number((rule.match(/font-size:\s*(\d+)px/) || [])[1] || 13);
      assert.ok(size >= 13, `${sel}: ink-3 below 13px`);
    }
  }
});

test('landing and feature pages use the vignettes; How it works keeps every step visible', () => {
  assert.match(src('components/landing/FeatureGrid.tsx'), /<PassageVignette[\s\S]*<LanguagesVignette[\s\S]*<TranslationVignette/);
  const how = src('components/landing/HowItWorks.tsx');
  assert.match(how, /FormatsVignette[\s\S]*AnswerVignette[\s\S]*PassageVignette/);
  assert.match(how, /steps\.map\([\s\S]*t\(titleKey\)[\s\S]*t\(descKey\)/);
  assert.doesNotMatch(how, /hidden=\{|aria-expanded/, 'no accordion: the HowTo schema matches visible text');
  for (const [file, name] of [
    ['app/features/citations/CitationsContent.tsx', 'PassageVignette'],
    ['app/features/multilingual/MultilingualContent.tsx', 'LanguagesVignette'],
    ['app/features/multi-format/MultiFormatContent.tsx', 'FormatsVignette'],
    ['app/features/layout-translation/LayoutTranslationPageContent.tsx', 'TranslationVignette'],
  ]) {
    const code = src(file);
    assert.match(code, /variant="product"/, `${file} hero is not the product variant`);
    assert.ok(code.includes(`<${name}`), `${file} does not render ${name}`);
  }
});

test('the reader names the last free question before it is spent', () => {
  const chat = src('components/Chat/ChatPanel.tsx');
  assert.match(chat, /demoRemaining === 1\s*\?\s*tOr\('demo\.lastQuestion'/);
});

test('vignette and last-question strings exist in all 11 locales', () => {
  const keys = ['landing.vignette.original', 'landing.vignette.translated', 'landing.vignette.drop', 'landing.vignette.page', 'demo.lastQuestion',
    'landing.frame.question', 'landing.frame.answer', 'landing.frame.source'];
  for (const l of LOCALES) {
    const m = JSON.parse(src(`i18n/locales/${l}.json`));
    for (const k of keys) assert.ok(m[k], `${l}.json missing ${k}`);
    assert.ok(m['landing.vignette.page'].includes('{page}'), `${l} page label lost {page}`);
  }
});
