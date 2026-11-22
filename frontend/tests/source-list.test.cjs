const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
require('./_load-ts.cjs');
const {
  SOURCE_PREVIEW_LIMIT, visibleSources, spansMultipleDocuments, shortSnippet,
} = require('../src/lib/sourceList.ts');

const src = (p) => fs.readFileSync(path.join(__dirname, '../src', p), 'utf8');

test('a long source list shows the first few until expanded', () => {
  const items = Array.from({ length: 15 }, (_, i) => i + 1);
  assert.deepEqual(visibleSources(items, false), items.slice(0, SOURCE_PREVIEW_LIMIT));
  assert.deepEqual(visibleSources(items, true), items);
  assert.deepEqual(visibleSources(items.slice(0, SOURCE_PREVIEW_LIMIT), false), items.slice(0, SOURCE_PREVIEW_LIMIT));
});

test('the active citation stays visible in a collapsed list', () => {
  const items = Array.from({ length: 15 }, (_, i) => i + 1);
  assert.deepEqual(visibleSources(items, false, (n) => n === 12), [1, 2, 3, 4, 5, 12]);
});

test('file names only label chips when the answer cites several documents', () => {
  assert.equal(spansMultipleDocuments([{}, {}, {}]), false);
  assert.equal(spansMultipleDocuments([{ documentId: 'a' }, { documentId: 'a' }, {}]), false);
  assert.equal(spansMultipleDocuments([{ documentId: 'a' }, { documentId: 'b' }]), true);
  assert.equal(spansMultipleDocuments([{ documentFilename: 'x.pdf' }, { documentFilename: 'y.pdf' }]), true);
});

test('snippets are cut by code point and stripped of control characters', () => {
  assert.equal(shortSnippet('a\u0007b  c', 60), 'ab c');
  assert.equal(shortSnippet('😀'.repeat(5), 3), '😀😀😀…');
  assert.equal(shortSnippet(''), '');
  assert.equal(shortSnippet(null), '');
});

test('source lists render nothing below 12px and no mono uppercase labels', () => {
  for (const file of ['components/Chat/SourcesStrip.tsx', 'components/Chat/CitationCard.tsx', 'components/Chat/SourceListToggle.tsx']) {
    const code = src(file);
    assert.ok(!/text-\[(?:[0-9]|1[01])px\]/.test(code), `${file} has text below 12px`);
    assert.ok(!/\buppercase\b|--dt-mono|font-mono/.test(code), `${file} uses a mono or uppercase label`);
  }
});

test('the landing proof strip links each fact and adds no filled CTA', () => {
  const code = src('components/landing/ProofStrip.tsx');
  assert.ok(!/className="ed-cta\b/.test(code), 'the hero owns the view\'s one .ed-cta');
  for (const pathName of ['/features/multilingual', '/features/multi-format', '/features/citations']) {
    assert.ok(code.includes(`'${pathName}'`), `missing link to ${pathName}`);
    assert.ok(fs.existsSync(path.join(__dirname, '../src/app', pathName, 'page.tsx')), `${pathName} has no page`);
  }
  for (const id of ['how-it-works', 'security', 'faq']) {
    assert.ok(code.includes(`'#${id}'`));
    const owner = fs.readdirSync(path.join(__dirname, '../src/components/landing'))
      .some((f) => src(`components/landing/${f}`).includes(`id="${id}"`));
    assert.ok(owner, `no landing section has id="${id}"`);
  }
  const locales = fs.readdirSync(path.join(__dirname, '../src/i18n/locales'));
  assert.equal(locales.length, 11);
  for (const file of locales) {
    const messages = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/i18n/locales', file), 'utf8'));
    for (const key of [
      'landing.proof.ariaLabel', 'landing.proof.nav.ariaLabel',
      'landing.proof.languages.value', 'landing.proof.languages.label',
      'landing.proof.formats.value', 'landing.proof.formats.label',
      'landing.proof.jump.value', 'landing.proof.jump.label',
      'chat.sources.showAll', 'chat.sources.showFewer', 'citation.passageFallback',
    ]) assert.ok(messages[key], `${file} is missing ${key}`);
    assert.ok(messages['chat.sources.showAll'].includes('{count}'), `${file} showAll lost {count}`);
  }
});
