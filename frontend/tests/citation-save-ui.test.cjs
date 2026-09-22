const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Wiring for the evidence-bar "Save quote" (plan .collab/plans/2026-09-22-next-strategy.md §6). The
// decisions live in lib/citationSave.ts (tests/citation-save.test.cjs); these assert that the UI renders
// only what the server returned, never blocks on a cached count, and never submits a billed search.

const src = path.resolve(__dirname, '../src');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const CONTROLS = 'components/Quotes/CitationSaveControls.tsx';
const READER = 'app/d/[documentId]/DocumentReaderPageClient.tsx';
const PANEL = 'components/Quotes/QuoteFinderPanel.tsx';
const VIEWER = 'components/PdfViewer/PdfViewer.tsx';

test('the save button is disabled only while a save is in flight, never by a cached count', () => {
  const code = stripComments(read(CONTROLS));
  const disabled = [...code.matchAll(/disabled=\{([^}]*)\}/g)].map((m) => m[1].trim());
  assert.deepEqual(disabled, ["state.status === 'saving'"]);
});

test('the saved notice shows the server row and its per-kind trust label, never the client sentence', () => {
  const code = stripComments(read(CONTROLS));
  assert.match(code, /state\.quote\.quoteText/);
  assert.match(code, /trustLabel\(state\.quote\.sourceKind/);
  assert.match(code, /tierLabel\(state\.quote\.tier/);
  assert.doesNotMatch(code, /focusSnippet|textSnippet|citation\./);
});

test('the viewer exposes evidence-bar slots and renders them inside the bar', () => {
  const code = read(VIEWER);
  assert.match(code, /evidenceActions\?: React\.ReactNode/);
  assert.match(code, /evidenceNotice\?: React\.ReactNode/);
  const bar = code.slice(code.indexOf('dt-evidence-bar'), code.indexOf('</div>}', code.indexOf('dt-evidence-bar')));
  assert.match(bar, /\{evidenceActions\}/);
  assert.match(bar, /\{evidenceNotice\}/);
});

test('both PDF viewers in the reader carry the save button and its notice', () => {
  const code = read(READER);
  assert.equal((code.match(/evidenceActions=\{/g) || []).length, 2);
  assert.equal((code.match(/evidenceNotice=\{/g) || []).length, 2);
});

test('the reader saves through saveCitationAsQuote and handles every outcome', () => {
  const code = stripComments(read(READER));
  assert.match(code, /saveCitationAsQuote\(/);
  assert.match(code, /save:\s*saveQuote/);
  for (const kind of ['signin', 'saved', 'fallback', 'limit', 'error']) {
    assert.match(code, new RegExp(`case '${kind}'`), `outcome ${kind} is not handled`);
  }
  // A late result for a citation the reader has moved away from is dropped.
  assert.match(code, /citationTarget !== target/);
});

test('the fallback opens Quote Finder prefilled and tagged, and the limit opens the quote paywall', () => {
  const code = stripComments(read(READER));
  assert.match(code, /setQuoteFinderOpenSource\('citation_evidence_bar'\)/);
  assert.match(code, /setQuoteFinderPrefillTopic\(outcome\.topic\)/);
  assert.match(code, /openSource=\{quoteFinderOpenSource\}/);
  assert.match(code, /trackEvent\('paywall_opened', \{\s*source: 'quote_save',\s*reason: 'SAVED_QUOTES_LIMIT_REACHED'/);
});

test('opening Quote Finder never submits a search', () => {
  const code = stripComments(read(PANEL));
  assert.match(code, /source: openSource \?\?/);
  // The billed search is only reachable from the form's submit handler.
  assert.equal((code.match(/trackEvent\('quote_search_submitted'/g) || []).length, 1);
  const calls = [...code.matchAll(/handleSearch\(/g)].length;
  assert.equal(calls, 1, 'handleSearch is called from somewhere other than the form');
  assert.match(code, /onSubmit=\{\(e\) => void handleSearch\(e\)\}/);
});

test('the new controls follow the app palette rules', () => {
  const code = read(CONTROLS);
  assert.doesNotMatch(code, /\b(gray|indigo|violet|purple)-\d/);
  assert.doesNotMatch(code, /transition-all/);
  assert.doesNotMatch(code, /text-\[(?:[0-9]|1[01])px\]/);
  // `*-white/NN` is a dark-glass leftover on a light surface unless it is a dark: variant.
  for (const [token] of code.matchAll(/[\w:-]*(?:bg|text|border)-white\/\d+/g)) {
    assert.ok(token.startsWith('dark:'), `light-surface ${token} needs a light-mode value`);
  }
});

// Slice 2 (plan §2.1 (b)–(d)): attribution, the popover entry, and the eleven locales.

test('saveQuote sends the source, so bridge saves are countable apart from Quote Finder saves', () => {
  const code = stripComments(read('lib/api.ts'));
  const fn = code.slice(code.indexOf('export async function saveQuote'), code.indexOf('export async function listDocumentSavedQuotes'));
  assert.match(fn, /source\?: 'quote_finder' \| 'citation_evidence_bar' \| 'citation_popover'/);
  assert.match(fn, /source: params\.source/);
});

test('the reader tags each entry: the evidence bar and the popover save under their own source', () => {
  const code = stripComments(read(READER));
  assert.match(code, /source,\s*\}\);|source \}\);|source: saveSource/);
  assert.match(code, /handleSaveCitationQuote\('citation_evidence_bar'\)/);
  assert.match(code, /handleSaveCitationQuote\('citation_popover'\)/);
  // Only the PDF viewer has an evidence bar to show the result, so the popover entry is wired there only.
  assert.match(code, /onCitationSave=\{citationsOpenInPdf \? handleCitationSave : undefined\}/);
  assert.match(code, /const citationsOpenInPdf = fileType === 'pdf' \|\| Boolean\(useConvertedPdf\)/);
  assert.match(code, /openAuthModal\(\{ source: 'citation_save' \}\)/);
});

test('the popover shows Save quote only when a save handler is wired, and the chat threads it with the message id', () => {
  const popover = stripComments(read('components/Chat/CitationPopover.tsx'));
  assert.match(popover, /onSaveQuote\?: \(\) => void/);
  assert.match(popover, /\{onSaveQuote && \(/);
  const bubble = stripComments(read('components/Chat/MessageBubble.tsx'));
  assert.match(bubble, /onCitationSave\?: \(c: Citation\) => void/);
  assert.match(bubble, /onSaveQuote=\{onSave \? \(\) => onSave\(citation\) : undefined\}/);
  const panel = stripComments(read('components/Chat/ChatPanel.tsx'));
  assert.match(panel, /onCitationSave\?: \(c: Citation, messageId\?: string\) => void/);
  assert.match(panel, /onCitationSave\?\.\(citation, message\.id\)/);
});

test('the sign-in modal reports where it was opened from, then forgets it', () => {
  const lib = stripComments(read('lib/auth-modal.ts'));
  assert.match(lib, /openAuthModal\(options\?: \{ callbackUrl\?: string; source\?: string \}\)/);
  assert.match(lib, /export function peekAuthSourceOverride\(\)/);
  const modal = stripComments(read('components/AuthModal.tsx'));
  assert.match(modal, /trackEvent\('auth_modal_opened', \{ source: peekAuthSourceOverride\(\) \?\? 'auth_modal' \}\)/);
  assert.match(modal, /clearAuthSourceOverride\(\)/);
});

test('every bridge string exists in all eleven locales', () => {
  const keys = ['evidence.saveQuote', 'evidence.quoteSaving', 'evidence.quoteSavedShort', 'evidence.saveQuoteHint', 'evidence.quoteSaved'];
  for (const locale of ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi']) {
    const messages = JSON.parse(read(`i18n/locales/${locale}.json`));
    for (const key of keys) {
      assert.ok(typeof messages[key] === 'string' && messages[key].trim(), `${locale}: ${key} is missing`);
    }
  }
});

test('openAuthModal remembers where it was opened from until the next open or a clear', () => {
  const Module = require('node:module');
  const ts = require('typescript');
  const filename = path.join(src, 'lib/auth-modal.ts');
  const loaded = new Module(filename, module);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  const auth = loaded.exports;
  global.window = { location: { hash: '' } };
  try {
    auth.openAuthModal({ source: 'citation_save' });
    assert.equal(auth.peekAuthSourceOverride(), 'citation_save');
    auth.openAuthModal();
    assert.equal(auth.peekAuthSourceOverride(), null, 'a plain open must not inherit an earlier source');
    auth.openAuthModal({ source: 'citation_save' });
    auth.clearAuthSourceOverride();
    assert.equal(auth.peekAuthSourceOverride(), null);
  } finally {
    delete global.window;
  }
});
