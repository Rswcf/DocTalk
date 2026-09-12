const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = loaded.require.bind(loaded);
  loaded.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : realRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports;
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const preview = () => ({ active_count: 0, snapshot_digest: 'a'.repeat(64), preview: { document_name: 'source.txt', messages: [{ id: 'msg-123', content: 'Only selected answer', citations: [] }] } });

function harness(api) {
  const slots = [];
  let cursor = 0, effects = [], tree;
  const cleanups = [];
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ||= { value }; return [slots[i].value, (next) => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useId() { return `id-${cursor++}`; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((value, index) => !Object.is(value, slots[i].deps[index]))) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((value, index) => !Object.is(value, slots[i].deps[index]))) { effects.push({ i, effect }); slots[i] = { deps }; }
    },
  };
  const t = (key) => key;
  const locale = { t, tOr: t };
  const metrics = { closed: false, restored: 0, modal: false, copied: [] };
  const oldDocument = global.document, oldElement = global.HTMLElement, oldNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
  global.HTMLElement = class { isConnected = true; focus() { metrics.restored++; } };
  global.document = { activeElement: new global.HTMLElement() };
  Object.defineProperty(global, 'navigator', { configurable: true, value: { clipboard: { writeText: async (text) => { metrics.copied.push(text); } } } });
  const jsx = (type, props) => {
    if (type === 'dialog' && props.ref) props.ref.current = { showModal() { metrics.modal = true; }, close() { metrics.modal = false; } };
    return { type, props };
  };
  const Component = load('components/Chat/ShareAnswerDialog.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': { X: 'svg' }, '../../i18n': { useLocale: () => locale },
    '../../lib/api': api, '../../lib/errorCopy': { errorCopy: (e) => ({ body: e.message }) }, '../../lib/analytics': { trackEvent() {} },
  }).default;
  const unmount = () => { for (const fn of cleanups) fn?.(); };
  return {
    metrics,
    render() {
      cursor = 0; effects = [];
      tree = Component({ sessionId: 'session', messageId: 'backend-uuid', onClose() { metrics.closed = true; unmount(); } });
      for (const { i, effect } of effects) { cleanups[i]?.(); cleanups[i] = effect(); }
      return tree;
    },
    button(label) {
      function find(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'button' && (node.props.children === label || node.props['aria-label'] === label)) return node.props;
        for (const child of [node.props?.children].flat(Infinity)) { const hit = find(child); if (hit) return hit; }
      }
      const result = find(tree); assert.ok(result, label); return result;
    },
    text() { return JSON.stringify(tree); },
    cleanup() { unmount(); global.document = oldDocument; global.HTMLElement = oldElement; if (oldNavigator) Object.defineProperty(global, 'navigator', oldNavigator); else delete global.navigator; },
  };
}

test('answer API sends the selected backend ID and approved digest, never full-share endpoint', async () => {
  const api = load('lib/api.ts'), original = global.fetch, calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(preview()), { status: 200 }); };
  try {
    await api.getAnswerSharePreview('session', 'backend-uuid');
    await api.createAnswerShare('session', 'backend-uuid', 'a'.repeat(64));
    await api.revokeAnswerShares('session', 'backend-uuid');
    assert.ok(calls.every(({ url }) => url.endsWith('/api/sessions/session/answers/backend-uuid/share')));
    assert.equal(calls[0].options.cache, 'no-store');
    assert.deepEqual(JSON.parse(calls[1].options.body), { snapshot_digest: 'a'.repeat(64) });
    assert.equal(calls[2].options.method, 'DELETE');
  } finally { global.fetch = original; }
});

test('preview opens without publication; copy uses its digest and revoke clears URL', async () => {
  const created = [], revoked = [];
  const h = harness({ getAnswerSharePreview: async () => preview(), createAnswerShare: async (...args) => { created.push(args); return { url: 'http://localhost/shared/answer' }; }, revokeAnswerShares: async (...args) => { revoked.push(args); } });
  try {
    h.render(); await flush(); h.render();
    assert.equal(h.metrics.modal, true); assert.equal(created.length, 0);
    h.button('share.copyAnswerLink').onClick(); await flush(); h.render();
    assert.deepEqual(created, [['session', 'backend-uuid', 'a'.repeat(64)]]);
    assert.deepEqual(h.metrics.copied, ['http://localhost/shared/answer']);
    h.button('share.revokeAnswer').onClick(); await flush(); h.render();
    assert.equal(revoked.length, 1); assert.ok(!h.text().includes('http://localhost/shared/answer'));
    assert.ok(h.text().includes('share.answerRevoked'));
  } finally { h.cleanup(); }
});

test('closing during creation prevents a late clipboard write', async () => {
  const creation = deferred();
  const h = harness({ getAnswerSharePreview: async () => preview(), createAnswerShare: () => creation.promise });
  try {
    h.render(); await flush(); h.render(); h.button('share.copyAnswerLink').onClick();
    h.button('common.close').onClick();
    creation.resolve({ url: 'http://localhost/shared/late' }); await flush();
    assert.equal(h.metrics.closed, true); assert.deepEqual(h.metrics.copied, []); assert.ok(h.metrics.restored > 0);
  } finally { h.cleanup(); }
});

test('changed answer blocks sharing until preview reload, then needs another click', async () => {
  let reads = 0, creates = 0;
  const h = harness({ getAnswerSharePreview: async () => { reads++; return preview(); }, createAnswerShare: async () => { creates++; throw new Error('SHARE_CHANGED'); } });
  try {
    h.render(); await flush(); h.render(); h.button('share.copyAnswerLink').onClick(); await flush(); h.render();
    assert.equal(h.button('share.copyAnswerLink').disabled, true);
    h.button('common.retry').onClick(); await flush(); h.render();
    assert.equal(reads, 2); assert.equal(creates, 1); assert.equal(h.button('share.copyAnswerLink').disabled, false);
  } finally { h.cleanup(); }
});

test('clipboard refusal keeps the created link available for manual copy', async () => {
  const h = harness({ getAnswerSharePreview: async () => preview(), createAnswerShare: async () => ({ url: 'http://localhost/shared/manual' }) });
  try {
    navigator.clipboard.writeText = async () => { throw new Error('clipboard denied'); };
    h.render(); await flush(); h.render(); h.button('share.copyAnswerLink').onClick(); await flush(); h.render();
    assert.ok(h.text().includes('http://localhost/shared/manual')); assert.ok(h.text().includes('share.copyManually'));
  } finally { h.cleanup(); }
});
