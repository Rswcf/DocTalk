const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
require('./_load-ts.cjs');
const { useDocTalkStore: store } = require('../src/store/index.ts');
const { createCollectionSessions } = require('../src/lib/collectionSessions.ts');
function load(relative, mocks) {
  const filename = path.resolve(__dirname, '../src', relative), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); const actual = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : actual(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
function hook(chatStream) {
  const useStore = selector => selector ? selector(store.getState()) : store.getState(); useStore.getState = store.getState;
  return load('lib/useChatStream.ts', {
    react: { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }) },
    './sse': { chatStream }, '../store': { useDocTalkStore: useStore },
    '../components/CreditsDisplay': { triggerCreditsRefresh() {} }, './analytics': { trackEvent() {} },
  }).useChatStream({ sessionId: 'A', selectedMode: 'quick', locale: 'en', t: key => key, tOr: (_, fallback) => fallback, onShowPaywall() {}, onRequireAuth() {} });
}
function setup() {
  store.getState().reset();
  store.getState().setSessions(['A', 'B'].map(id => ({ session_id: id, title: id, message_count: 0, created_at: 'now', last_activity_at: 'now', domain_mode: null })));
  store.getState().setSessionId('A');
}
test('real chat hook sends selected mode and records only the confirmed sent mode in session metadata', async () => {
  for (const mode of ['legal', 'academic', null]) {
    setup(); store.getState().setDomainMode(mode);
    let sent;
    const chat = hook(async (...args) => {
      sent = args[10];
      // A newer local selection cannot change which mode this request used.
      store.getState().setDomainMode(mode === 'legal' ? 'academic' : 'legal');
      args[5]({ message_id: 'confirmed-answer' });
    });
    await chat.sendMessage('question');
    assert.equal(sent, mode);
    assert.equal(store.getState().sessions.find(row => row.session_id === 'A').domain_mode, mode);
    assert.equal(store.getState().isStreaming, false);
    const selectionEpoch = store.getState().domainModeEpoch;
    store.getState().restoreSession('B', [], 'academic', selectionEpoch);
    store.getState().restoreSession('A', [], store.getState().sessions.find(row => row.session_id === 'A').domain_mode, selectionEpoch);
    assert.equal(store.getState().domainMode, mode, 'A→B→A uses the confirmed server mode, including Default');
  }
});
test('fallback EOF completion does not claim that session mode was confirmed saved', async () => {
  setup(); store.getState().setDomainMode('legal');
  await hook(async (...args) => args[5]({ message_id: '' })).sendMessage('question');
  assert.equal(store.getState().sessions[0].domain_mode, null);
});
test('real stream survives collection switch attempts and accepts another send after done', async () => {
  setup(); let callbacks, finish;
  const chat = hook(async (...args) => { callbacks = args; await new Promise(resolve => { finish = resolve; }); });
  const collection = createCollectionSessions('C', {
    getState: store.getState, publish: store.setState, isCurrent: () => true, onError() {},
    messages: async () => ({ messages: [] }), list: async () => ({ sessions: [] }), create: async () => { throw Error('must not create during stream'); },
  });
  const first = chat.sendMessage('first');
  assert.equal(store.getState().isStreaming, true);
  await collection.open('B'); await collection.newSession();
  assert.equal(store.getState().sessionId, 'A');
  callbacks[5]({ message_id: 'answer-1' }); finish(); await first;
  assert.equal(store.getState().isStreaming, false);
  const second = chat.sendMessage('second'); callbacks[5]({ message_id: 'answer-2' }); finish();
  assert.equal(await second, true); assert.equal(store.getState().isStreaming, false);
});
test('real SSE request explicitly sends Default as null rather than inheriting Legal', async () => {
  const previous = global.fetch, sent = [];
  try {
    global.fetch = async (_, options) => { sent.push(JSON.parse(options.body)); return new Response('event: done\ndata: {"message_id":"saved"}\n\n', { status: 200 }); };
    const { chatStream } = require('../src/lib/sse.ts');
    for (const mode of ['legal', 'academic', null]) {
      await chatStream('A', 'question', () => {}, () => {}, error => { throw error; }, () => {}, undefined, 'quick', 'en', undefined, mode);
    }
    assert.deepEqual(sent.map(body => body.domain_mode), ['legal', 'academic', null]);
    assert.ok(sent.every(body => Object.hasOwn(body, 'domain_mode')));
  } finally { global.fetch = previous; }
});
test('all 11 locales provide the collection session failure message', () => {
  const locales = ['en','zh','ja','ko','es','de','fr','pt','it','ar','hi'];
  for (const locale of locales) assert.ok(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/i18n/locales', `${locale}.json`), 'utf8'))['collections.sessionLoadError']);
});

test('real DomainModeSelector Default click increments intent epoch and streaming disables its controls', () => {
  setup(); store.getState().setDomainMode('legal');
  const useStore = selector => selector(store.getState());
  const Component = load('components/Chat/DomainModeSelector.tsx', {
    '../../store': { useDocTalkStore: useStore }, '../../i18n': { useLocale: () => ({ tOr: (_, fallback) => fallback }) },
  }).default;
  const before = store.getState().domainModeEpoch;
  const controls = Component().props.children;
  controls[0].props.onClick();
  assert.equal(store.getState().domainMode, null);
  assert.equal(store.getState().domainModeEpoch, before + 1);
  store.getState().setStreaming(true);
  const disabled = Component().props.children;
  assert.ok(disabled.every(button => button.props.disabled));
  disabled[1].props.onClick(); assert.equal(store.getState().domainMode, null);
  store.getState().setStreaming(false);
});
test('real collection SessionList disables both historical Open and New buttons during stream', () => {
  const Component = load('components/Collections/SessionList.tsx', {
    '../../i18n': { useLocale: () => ({ tOr: (_, fallback) => fallback }) },
  }).default;
  const tree = Component({ sessions: [{ session_id: 'A', title: 'A', message_count: 0 }], activeSessionId: 'A', disabled: true, onSelectSession() {}, onNewSession() {} });
  const all = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(all) : [node, ...all(node.props?.children)];
  const buttons = all(tree).filter(node => node.type === 'button');
  assert.equal(buttons.length, 2); assert.ok(buttons.every(button => button.props.disabled));
});
