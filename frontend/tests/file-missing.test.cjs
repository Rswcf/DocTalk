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
  const state = { pdfUrl: undefined, intervals: new Map(), cleared: 0 };
  const store = {
    setDocument() {}, setPdfUrl: value => { state.pdfUrl = value; }, clearDocumentTransientState() {},
    setDocumentName() {}, setDocumentStatus() {}, setIsDemo() {}, setLastDocument() {},
    setDocumentSummary() {}, setSuggestedQuestions() {},
  };
  const locale = { t: key => key, tOr: (_key, fallback) => fallback };
  const realSet = global.setInterval, realClear = global.clearInterval;
  let nextId = 1;
  global.setInterval = fn => { const id = nextId++; state.intervals.set(id, fn); return id; };
  global.clearInterval = id => { if (state.intervals.delete(id)) state.cleared++; };
  const h = harness('useDocumentLoader.ts', 'useDocumentLoader', {
    './api': { ApiError, getDocument: async () => info, getDocumentFileUrl: fileUrl, getConvertedFileUrl: convertedUrl },
    './errorCopy': { errorCopy: e => ({ body: `copy:${e?.code ?? 'unknown'}` }), parseWorkerErrorMsg: () => ({}) },
    './utils': { sanitizeFilename: x => x },
    '../i18n': { useLocale: () => locale },
    '../store': { useDocTalkStore: () => store },
  });
  const restore = () => { h.unmount(); global.setInterval = realSet; global.clearInterval = realClear; };
  const tick = () => { for (const fn of [...state.intervals.values()]) fn(); };
  return { h, state, restore, tick };
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

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('a URL renewal that finds the original gone switches to the text view', async () => {
  let calls = 0;
  const { h, state, restore } = setup({
    info: { status: 'ready', file_type: 'pdf', filename: 'a.pdf' },
    fileUrl: async () => {
      calls++;
      if (calls === 1) return { url: 'https://files.test/a.pdf?sig=1' };
      throw new ApiError(410, 'FILE_MISSING', { variant: 'original' });
    },
    convertedUrl: async () => ({ url: 'unused' }),
  });
  try {
    h.render('doc-r');
    await flush();
    assert.equal(state.pdfUrl, 'https://files.test/a.pdf?sig=1');
    const renewed = await h.render('doc-r').refreshPdfUrl();
    assert.equal(renewed, undefined);
    const loader = h.render('doc-r');
    assert.equal(loader.missingFile, 'original');
    assert.equal(loader.error, null);
    assert.equal(state.pdfUrl, null);
  } finally { restore(); }
});

test('a converted-PDF renewal that finds the file gone drops the page view', async () => {
  let calls = 0;
  const { h, restore } = setup({
    info: { status: 'ready', file_type: 'pptx', filename: 'a.pptx', has_converted_pdf: true },
    fileUrl: async () => ({ url: 'unused' }),
    convertedUrl: async () => {
      calls++;
      if (calls === 1) return { url: 'https://files.test/a.converted.pdf' };
      throw new ApiError(410, 'FILE_MISSING', { variant: 'converted' });
    },
  });
  try {
    h.render('doc-c');
    await flush();
    assert.equal(h.render('doc-c').hasConvertedPdf, true);
    await h.render('doc-c').refreshConvertedPdfUrl();
    const loader = h.render('doc-c');
    assert.equal(loader.hasConvertedPdf, false);
    assert.equal(loader.convertedPdfUrl, null);
    assert.equal(loader.missingFile, 'converted');
  } finally { restore(); }
});

test('other renewal failures still reach the PDF viewer', async () => {
  let calls = 0;
  const { h, restore } = setup({
    info: { status: 'ready', file_type: 'pdf', filename: 'a.pdf' },
    fileUrl: async () => {
      calls++;
      if (calls === 1) return { url: 'https://files.test/a.pdf' };
      throw new ApiError(502, 'STORAGE_UNAVAILABLE');
    },
    convertedUrl: async () => ({ url: 'unused' }),
  });
  try {
    h.render('doc-e');
    await flush();
    await assert.rejects(h.render('doc-e').refreshPdfUrl(), err => err.code === 'STORAGE_UNAVAILABLE');
    assert.equal(h.render('doc-e').missingFile, null);
  } finally { restore(); }
});

test('polls never overlap: a slow storage check is not raced by the next tick', async () => {
  const pending = [];
  const { h, restore, tick } = setup({
    info: { status: 'ready', file_type: 'pdf', filename: 'a.pdf' },
    fileUrl: () => { const d = deferred(); pending.push(d); return d.promise; },
    convertedUrl: async () => ({ url: 'unused' }),
  });
  try {
    h.render('doc-p');
    await flush();
    assert.equal(pending.length, 1);
    tick(); tick();
    await flush();
    assert.equal(pending.length, 1, 'no second request while the first is in flight');
    pending[0].reject(new ApiError(410, 'FILE_MISSING', { variant: 'original' }));
    await flush();
    assert.equal(h.render('doc-p').missingFile, 'original');
  } finally { restore(); }
});

test('a missing file found after a transient error clears that error', async () => {
  let calls = 0;
  const { h, state, restore, tick } = setup({
    info: { status: 'ready', file_type: 'pdf', filename: 'a.pdf' },
    fileUrl: async () => {
      calls++;
      if (calls === 1) throw new ApiError(502, 'STORAGE_UNAVAILABLE');
      throw new ApiError(410, 'FILE_MISSING', { variant: 'original' });
    },
    convertedUrl: async () => ({ url: 'unused' }),
  });
  try {
    h.render('doc-t');
    await flush();
    assert.equal(h.render('doc-t').error, 'copy:STORAGE_UNAVAILABLE');
    assert.equal(state.intervals.size, 1, '5xx keeps polling');
    tick();
    await flush();
    const loader = h.render('doc-t');
    assert.equal(loader.missingFile, 'original');
    assert.equal(loader.error, null);
    assert.equal(state.intervals.size, 0);
  } finally { restore(); }
});
