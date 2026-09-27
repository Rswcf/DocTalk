// A document whose stored file was lost (410 FILE_MISSING from /file-url) is
// not an error: the reader shows the extracted text with a notice, and chat,
// citations and Quote Finder keep working. See docs/ARCHITECTURE.md §10.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function harness(relative, name, mocks = {}) {
  const slots = [], cleanups = [];
  let cursor = 0, effects = [];
  const react = {
    useRef(value) { return slots[cursor++] ||= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ||= { value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((v, j) => !Object.is(v, slots[i].deps[j]))) {
        slots[i] = { deps }; effects.push({ i, effect });
      }
    },
  };
  const filename = path.resolve(__dirname, '../src/lib', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  const dependencies = { react, ...mocks };
  loaded.require = request => { assert.ok(Object.hasOwn(dependencies, request), request); return dependencies[request]; };
  loaded._compile(compiled, filename);
  return {
    render(...args) {
      cursor = 0; effects = [];
      const result = loaded.exports[name](...args);
      for (const { i, effect } of effects) { cleanups[i]?.(); cleanups[i] = effect(); }
      return result;
    },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
}

class ApiError extends Error {
  constructor(status, code, detail = {}, raw = '') {
    super(`HTTP ${status}`);
    this.status = status; this.code = code; this.detail = detail; this.raw = raw;
  }
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function setup({ info, fileUrl, convertedUrl }) {
  const state = { pdfUrl: undefined, intervals: new Set(), cleared: 0 };
  const store = {
    setDocument() {}, setPdfUrl: value => { state.pdfUrl = value; }, clearDocumentTransientState() {},
    setDocumentName() {}, setDocumentStatus() {}, setIsDemo() {}, setLastDocument() {},
    setDocumentSummary() {}, setSuggestedQuestions() {},
  };
  const locale = { t: key => key, tOr: (_key, fallback) => fallback };
  const realSet = global.setInterval, realClear = global.clearInterval;
  let nextId = 1;
  global.setInterval = () => { const id = nextId++; state.intervals.add(id); return id; };
  global.clearInterval = id => { if (state.intervals.delete(id)) state.cleared++; };
  const h = harness('useDocumentLoader.ts', 'useDocumentLoader', {
    './api': { ApiError, getDocument: async () => info, getDocumentFileUrl: fileUrl, getConvertedFileUrl: convertedUrl },
    './errorCopy': { errorCopy: e => ({ body: `copy:${e?.code ?? 'unknown'}` }), parseWorkerErrorMsg: () => ({}) },
    './utils': { sanitizeFilename: x => x },
    '../i18n': { useLocale: () => locale },
    '../store': { useDocTalkStore: () => store },
  });
  const restore = () => { h.unmount(); global.setInterval = realSet; global.clearInterval = realClear; };
  return { h, state, restore };
}

test('missing original PDF falls back to extracted text instead of an error state', async () => {
  let fileCalls = 0;
  const { h, state, restore } = setup({
    info: { status: 'ready', file_type: 'pdf', filename: 'a.pdf' },
    fileUrl: async () => { fileCalls++; throw new ApiError(410, 'FILE_MISSING', { variant: 'original' }); },
    convertedUrl: async () => { throw new Error('not called'); },
  });
  try {
    h.render('doc-1');
    await flush();
    const loader = h.render('doc-1');
    assert.equal(loader.error, null);
    assert.equal(loader.errorCode, null);
    assert.equal(loader.missingFile, 'original');
    assert.equal(state.pdfUrl, null);
    assert.equal(fileCalls, 1);
    assert.equal(state.intervals.size, 0, 'polling stops once the loss is known');
  } finally { restore(); }
});

test('missing converted PDF hides the page view and keeps the text view', async () => {
  const { h, state, restore } = setup({
    info: { status: 'ready', file_type: 'docx', filename: 'a.docx', has_converted_pdf: true },
    fileUrl: async () => { throw new Error('not called for docx'); },
    convertedUrl: async () => { throw new ApiError(410, 'FILE_MISSING', { variant: 'converted' }); },
  });
  try {
    h.render('doc-2');
    await flush();
    const loader = h.render('doc-2');
    assert.equal(loader.error, null);
    assert.equal(loader.hasConvertedPdf, false);
    assert.equal(loader.convertedPdfUrl, null);
    assert.equal(loader.missingFile, 'converted');
    assert.equal(state.intervals.size, 0);
  } finally { restore(); }
});

test('a storage outage is still an error, not a missing file', async () => {
  const { h, restore } = setup({
    info: { status: 'ready', file_type: 'pdf', filename: 'a.pdf' },
    fileUrl: async () => { throw new ApiError(502, 'STORAGE_UNAVAILABLE'); },
    convertedUrl: async () => ({ url: 'unused' }),
  });
  try {
    h.render('doc-3');
    await flush();
    const loader = h.render('doc-3');
    assert.equal(loader.missingFile, null);
    assert.equal(loader.error, 'copy:STORAGE_UNAVAILABLE');
  } finally { restore(); }
});

test('switching documents clears a previous missing-file state', async () => {
  let missing = true;
  const { h, restore } = setup({
    info: { status: 'ready', file_type: 'pdf', filename: 'a.pdf' },
    fileUrl: async () => {
      if (missing) throw new ApiError(410, 'FILE_MISSING', { variant: 'original' });
      return { url: 'https://files.test/b.pdf' };
    },
    convertedUrl: async () => ({ url: 'unused' }),
  });
  try {
    h.render('doc-a');
    await flush();
    assert.equal(h.render('doc-a').missingFile, 'original');
    missing = false;
    h.render('doc-b');
    await flush();
    assert.equal(h.render('doc-b').missingFile, null);
  } finally { restore(); }
});
