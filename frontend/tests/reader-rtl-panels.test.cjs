const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// react-resizable-panels 4.x has no right-to-left support. In a production build the Arabic reader mounted the panel
// group, the locale then set <html dir="rtl">, and the next layout pass looked up the constraints of a panel index
// that does not exist ("Panel constraints not found for index 2") — the whole reader crashed for every Arabic
// desktop user (found in the 2026-09-23 site test; 3/3 on a local production build of main). The group therefore
// always lays out left to right, and each pane's content keeps the page's own direction.

const READER = path.resolve(__dirname, '../src/app/d/[documentId]/DocumentReaderPageClient.tsx');
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('the desktop panel group always lays out left to right', () => {
  const code = stripComments(fs.readFileSync(READER, 'utf8'));
  const group = code.indexOf('<Group orientation="horizontal"');
  assert.ok(group !== -1, 'the desktop reader still uses the resizable panel group');
  const wrapper = code.lastIndexOf('<div', group);
  assert.match(code.slice(wrapper, group), /dir="ltr"/, 'the element wrapping the panel group must pin dir="ltr"');
});

test('each pane keeps the page direction for its own content', () => {
  const code = stripComments(fs.readFileSync(READER, 'utf8'));
  assert.match(code, /const contentDir = LOCALES\.find\(\(l\) => l\.code === locale\)\?\.dir === 'rtl' \? 'rtl' : 'ltr';/);
  const group = code.slice(code.indexOf('<Group orientation="horizontal"'), code.indexOf('</Group>'));
  const panes = group.match(/className="dt-reader-pane[^"]*"[^>]*>/g) || [];
  assert.equal(panes.length, 2, 'both panes are found');
  for (const pane of panes) assert.match(pane, /dir=\{contentDir\}/);
});
