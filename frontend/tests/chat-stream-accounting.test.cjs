const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('anonymous Quote Finder hint opens auth before panel or private analytics', () => {
  const filename = path.resolve(
    __dirname,
    '../src/app/d/[documentId]/DocumentReaderPageClient.tsx',
  );
  const source = fs.readFileSync(filename, 'utf8');
  const start = source.indexOf('const handleTryQuoteFinder = useCallback');
  const end = source.indexOf('\n\n  useEffect(', start);
  const handler = source.slice(start, end);

  assert.match(handler, /if \(!isLoggedIn\)/);
  assert.ok(handler.indexOf('openAuthModal()') < handler.indexOf("trackEvent('quote_finder_chip_clicked'"));
  assert.ok(handler.indexOf('openAuthModal()') < handler.indexOf('setQuoteFinderOpen(true)'));
  assert.match(handler, /\}, \[isLoggedIn\]\);/);
});
