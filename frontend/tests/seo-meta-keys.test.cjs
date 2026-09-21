const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// Localized marketing pages take their <title> / <meta description> from dedicated
// SEO keys, never from the keys their hero renders. Until 2026-09-21 they shared
// keys, so rewriting a visible headline silently rewrote that page's search title
// in all ten translated locales. These assertions keep the two apart.

const src = path.resolve(__dirname, '../src');
const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(src, 'i18n/locales', `${l}.json`), 'utf8'))]),
);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const localeDir = path.join(src, 'app/[locale]');
const localePages = walk(localeDir).filter((f) => path.basename(f) === 'page.tsx');
const helperCallers = localePages.filter((f) => fs.readFileSync(f, 'utf8').includes('createMarketingLocalePage'));

test('every localized page except the landing goes through the metadata helper', () => {
  // Structural, not a count: a hand-written generateMetadata is invisible to
  // the key checks below. /use-cases/lawyers was exactly that until the Phase
  // 2a review (M1) and read its search title from the hero's keys.
  const landing = path.join(localeDir, 'page.tsx');
  const others = localePages.filter((f) => f !== landing);
  const handWritten = others.filter((f) => !helperCallers.includes(f)).map((f) => path.relative(src, f));
  assert.deepEqual(handWritten, [], `localized pages outside createMarketingLocalePage: ${handWritten.join(', ')}`);
  assert.ok(others.length >= 33, `expected at least 33 localized marketing pages, found ${others.length}`);
});

test('every localized marketing page points its metadata at its own dedicated SEO keys', () => {
  const owners = new Map();
  for (const file of helperCallers) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(src, file);
    assert.doesNotMatch(source, /\btitleKey:|\bdescKey:/, `${rel}: uses the removed titleKey/descKey params`);
    const title = source.match(/metaTitleKey: '([^']+)'/)?.[1];
    const desc = source.match(/metaDescKey: '([^']+)'/)?.[1];
    assert.match(title ?? '', /\.metaTitle$/, `${rel}: metaTitleKey must be a *.metaTitle key`);
    assert.match(desc ?? '', /\.metaDescription$/, `${rel}: metaDescKey must be a *.metaDescription key`);
    for (const key of [title, desc]) {
      // One page per key: a pasted key would give two pages one search title.
      assert.ok(!owners.has(key), `${rel}: ${key} is already used by ${owners.get(key)}`);
      owners.set(key, rel);
    }
    for (const locale of LOCALES) {
      for (const key of [title, desc]) {
        assert.ok(messages[locale][key]?.trim(), `${rel}: ${key} missing or empty in ${locale}.json`);
      }
    }
  }
});

test('the localized landing page reads its metadata from landing.meta* keys', () => {
  const source = fs.readFileSync(path.join(localeDir, 'page.tsx'), 'utf8');
  const metadata = source.slice(source.indexOf('generateMetadata'), source.indexOf('export default'));
  assert.match(metadata, /t\('landing\.metaTitle'\)/);
  assert.match(metadata, /t\('landing\.metaDescription'\)/);
  assert.doesNotMatch(metadata, /t\('landing\.headline'\)|t\('landing\.description'\)/,
    'the landing <title> must not follow the visible headline');
});

test('SEO keys are read only by metadata code, never rendered on the page', () => {
  // If a component rendered a *.metaTitle key, editing the search title would
  // change the visible page again -- the coupling this split exists to remove.
  // The helper itself is metadata code (and its usage example names a meta key).
  const allowed = new Set([...helperCallers, path.join(localeDir, 'page.tsx'), path.join(src, 'lib/marketingLocalePage.tsx')]);
  const offenders = walk(src)
    .filter((f) => !allowed.has(f) && !f.includes(`${path.sep}i18n${path.sep}locales${path.sep}`))
    // Quoted or backticked literals, and keys built from a template
    // (`${ns}.metaTitle`) or by concatenation (ns + '.metaTitle').
    // Comments are stripped first: prose may name a key without reading it.
    .filter((f) => /['"`][A-Za-z0-9]*\.meta(Title|Description)['"`]|\$\{[^}]*\}\.meta(Title|Description)/.test(
      fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'),
    ))
    .map((f) => path.relative(src, f));
  assert.deepEqual(offenders, [], `SEO keys referenced outside metadata code: ${offenders.join(', ')}`);
});
