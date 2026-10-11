const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

// Regression for the 2026-10-10 production report: a signed-in user opened a
// demo `/d/<id>?question=` link while they already had a conversation on that
// document. useChatSession published the session id BEFORE its transcript
// arrived, so ChatPanel mounted with an empty transcript and auto-submitted.
// The late transcript then replaced the local [question, empty answer] pair
// with the server rows, whose last row was the question the backend had just
// committed, and every streamed token was appended to that USER bubble (raw
// markdown, no citations, no SOURCES strip).
//
// Invariant under test: a session id is never published before the
// transcript that belongs to it is in the store.

function load(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = loaded.require.bind(loaded);
  loaded.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : realRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

const QUESTION = 'What BLEU score does the big Transformer reach on WMT 2014 English-to-German?';
const ANSWER = 'The big Transformer model reaches a **BLEU score of 28.4** on WMT 2014 English-to-German.';
const earlier = [
  { id: 'srv-u1', role: 'user', text: 'What is multi-head attention?', createdAt: 1, backendId: 'srv-u1' },
  { id: 'srv-a1', role: 'assistant', text: 'Multi-head attention runs several attention functions in parallel.', citations: [], createdAt: 2, backendId: 'srv-a1' },
];
const row = (id, messageCount = 0) => ({
  session_id: id, title: id, message_count: messageCount, created_at: '2026-10-10', last_activity_at: '2026-10-10',
});

function createStore() {
  const store = load('store/index.ts', {
    '../lib/models': { DEFAULT_MODE: 'quick', isKnownMode: () => false },
  }).useDocTalkStore;
  store.getState().setDocument('doc-1');
  store.getState().setDocumentStatus('ready');
  return store;
}

// The local writes ChatPanel performs when it auto-submits `?question=`:
// its gate fires on the first render where a session id is set, the
// transcript has no conversation messages and nothing is streaming
// (ChatPanel.tsx), and sendMessage then appends the question and an empty
// assistant placeholder before the first token arrives (useChatStream.ts).
// React batches store writes made in one synchronous run into one render, so
// the gate is evaluated in a microtask, after that run, as a render would be.
function watchLikeChatPanelAutoSubmit(store) {
  const seen = [];
  let submitted = false;
  store.subscribe((state, previous) => {
    if (!state.sessionId || state.sessionId === previous.sessionId) return;
    queueMicrotask(() => {
      const rendered = store.getState();
      if (!rendered.sessionId) return;
      seen.push({ sessionId: rendered.sessionId, messages: rendered.messages });
      const hasConversationMessages = rendered.messages.some((m) => m.id !== 'summary_synthetic');
      if (submitted || hasConversationMessages || rendered.isStreaming) return;
      submitted = true;
      rendered.addMessage({ id: 'local-u', role: 'user', text: QUESTION, createdAt: 10 });
      rendered.addMessage({ id: 'local-a', role: 'assistant', text: '', citations: [], createdAt: 10 });
      rendered.setStreaming(true);
      rendered.updateLastMessage(ANSWER);
    });
  });
  return { seen, didSubmit: () => submitted };
}

function runUseChatSession(store, api, demoStorage = {}) {
  const effects = [];
  const react = {
    useState(initial) { return [initial, () => {}]; },
    useEffect(fn) { effects.push(fn); },
  };
  const useStore = (selector) => selector ? selector(store.getState()) : store.getState();
  useStore.getState = store.getState;
  class ApiError extends Error {
    constructor(status) { super(`HTTP ${status}`); this.status = status; }
  }
  const { useChatSession } = load('lib/useChatSession.ts', {
    react,
    './api': { ApiError, ...api },
    '../store': { useDocTalkStore: useStore },
    './demoSessionStorage': {
      readDemoSession: () => null,
      writeDemoSession() {},
      clearDemoSession() {},
      ...demoStorage,
    },
  });
  useChatSession('doc-1');
  assert.equal(effects.length, 1);
  return effects[0]();
}

test('signed-in reuse publishes the latest session only together with its transcript', async () => {
  const store = createStore();
  const transcript = deferred();
  const watcher = watchLikeChatPanelAutoSubmit(store);
  runUseChatSession(store, {
    listSessions: async () => ({ sessions: [row('latest', 2)] }),
    getMessages: (id) => { assert.equal(id, 'latest'); return transcript.promise; },
    createSession: async () => { throw new Error('must not create when a session exists'); },
  });
  await settle();
  transcript.resolve({ messages: earlier });
  await settle();

  assert.deepEqual(watcher.seen.map((s) => s.sessionId), ['latest']);
  assert.deepEqual(watcher.seen[0].messages, earlier, 'session id was visible before its transcript');
  assert.deepEqual(store.getState().messages, earlier);
});

test('auto-submitted question during a session restore never streams into the user bubble', async () => {
  const store = createStore();
  const transcript = deferred();
  const watcher = watchLikeChatPanelAutoSubmit(store);
  runUseChatSession(store, {
    listSessions: async () => ({ sessions: [row('latest', 2)] }),
    getMessages: () => transcript.promise,
    createSession: async () => { throw new Error('must not create when a session exists'); },
  });
  await settle();
  // The backend commits the question before it streams, so a transcript read
  // that lands mid-stream already ends with it.
  transcript.resolve({
    messages: [...earlier, { id: 'srv-u2', role: 'user', text: QUESTION, createdAt: 3, backendId: 'srv-u2' }],
  });
  await settle();
  store.getState().flushPendingText();

  const userBubbles = store.getState().messages.filter((m) => m.role === 'user');
  for (const bubble of userBubbles) {
    assert.ok(!bubble.text.includes('BLEU score of 28.4'), `answer leaked into user bubble: ${JSON.stringify(bubble.text)}`);
  }
  assert.equal(watcher.didSubmit(), false, 'a restored, non-empty conversation is not a fresh session');
});

test('a document switch during the transcript fetch never publishes the stale session', async () => {
  const store = createStore();
  const transcript = deferred();
  const watcher = watchLikeChatPanelAutoSubmit(store);
  const cleanup = runUseChatSession(store, {
    listSessions: async () => ({ sessions: [row('latest', 2)] }),
    getMessages: () => transcript.promise,
    createSession: async () => { throw new Error('must not create'); },
  });
  await settle();
  cleanup();
  transcript.resolve({ messages: earlier });
  await settle();

  assert.equal(store.getState().sessionId, null);
  assert.deepEqual(store.getState().messages, []);
  assert.deepEqual(watcher.seen, []);
});

test('a failed transcript fetch still falls back to a fresh session', async () => {
  const store = createStore();
  const watcher = watchLikeChatPanelAutoSubmit(store);
  runUseChatSession(store, {
    listSessions: async () => ({ sessions: [row('latest', 2)] }),
    getMessages: async () => { throw new Error('network'); },
    createSession: async () => ({ session_id: 'fresh', created_at: '2026-10-10' }),
  });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await settle();
    await settle();
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(watcher.seen.map((s) => s.sessionId), ['fresh']);
  assert.equal(store.getState().sessionId, 'fresh');
  assert.equal(watcher.didSubmit(), true, 'a genuinely empty fresh session still auto-submits');
});

test('the other start-up branches already publish session and transcript together', async () => {
  // Anonymous re-adoption of a stored demo session.
  {
    const store = createStore();
    const watcher = watchLikeChatPanelAutoSubmit(store);
    runUseChatSession(store, {
      listSessions: async () => { throw new Error('adoption must skip listSessions'); },
      getMessages: async () => ({ messages: earlier, demo_messages_used: 1 }),
      createSession: async () => { throw new Error('adoption must skip createSession'); },
    }, { readDemoSession: () => 'stored' });
    await settle();
    assert.deepEqual(watcher.seen, [{ sessionId: 'stored', messages: earlier }]);
    assert.equal(watcher.didSubmit(), false);
  }
  // No session yet: create one, whose transcript is genuinely empty.
  {
    const store = createStore();
    const watcher = watchLikeChatPanelAutoSubmit(store);
    runUseChatSession(store, {
      listSessions: async () => ({ sessions: [] }),
      getMessages: async () => { throw new Error('a fresh session has nothing to fetch'); },
      createSession: async () => ({ session_id: 'fresh', created_at: '2026-10-10' }),
    });
    await settle();
    assert.deepEqual(watcher.seen.map((s) => s.sessionId), ['fresh']);
    assert.equal(watcher.didSubmit(), true);
    store.getState().flushPendingText();
    const [question, answer] = store.getState().messages;
    assert.equal(question.text, QUESTION);
    assert.equal(answer.role, 'assistant');
    assert.equal(answer.text, ANSWER);
  }
});

// SessionDropdown.onSwitchSession had the same order (clear the transcript,
// publish the new id, then fetch). It is reachable from the auto-submit: once
// a `?question=` link lands on a restored conversation and does not fire,
// switching to another conversation in the dropdown would fire it there.
function dropdownHarness({ getMessages, isDemo = false }) {
  const store = createStore();
  const state = store.getState();
  state.setIsDemo(isDemo);
  state.setSessions([row('current', 2), row('older', 2), row('oldest', 2)]);
  state.setSessionId('current');
  state.setMessages(earlier);
  const calls = { pointers: [], accounting: [] };
  for (const name of ['setDemoMessagesUsed', 'setDemoRestoredUserMsgCount', 'bumpDemoAccountingEpoch']) {
    const original = store.getState()[name];
    store.setState({ [name]: (...args) => { calls.accounting.push([name, store.getState().sessionId, ...args]); original(...args); } });
  }
  const slots = [];
  let index = 0;
  const react = {
    useState(initial) {
      const current = index++;
      if (!slots[current]) slots[current] = { value: initial };
      return [slots[current].value, (next) => { slots[current].value = typeof next === 'function' ? next(slots[current].value) : next; }];
    },
    useRef(initial) {
      const current = index++;
      if (!slots[current]) slots[current] = { current: initial };
      return slots[current];
    },
    useEffect() {},
    useMemo: (fn) => fn(),
  };
  const useStore = (selector) => selector ? selector(store.getState()) : store.getState();
  useStore.getState = store.getState;
  const t = (key) => key;
  const Component = load('components/SessionDropdown.tsx', {
    react,
    'lucide-react': Object.fromEntries(['ChevronDown', 'Plus', 'Trash2', 'Home', 'X'].map((name) => [name, () => null])),
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'next-auth/react': { useSession: () => ({ status: isDemo ? 'unauthenticated' : 'authenticated' }) },
    '../store': { useDocTalkStore: useStore },
    '../i18n': { useLocale: () => ({ t, tOr: (key, fallback) => fallback }) },
    '../lib/api': {
      createSession: async () => { throw new Error('not under test'); },
      getMessages,
      deleteSession: async () => {},
    },
    '../lib/errorCopy': { errorCopy: () => ({ body: 'error' }) },
    '../lib/analytics': { trackEvent() {} },
    '../lib/billing': { startPlanAwareBillingAction: async () => {}, getBillingErrorMessage: () => '' },
    '../lib/useDropdownKeyboard': { useDropdownKeyboard: () => () => {} },
    '../lib/demoSessionStorage': {
      clearDemoSession() {}, readDemoSession: () => null,
      writeDemoSession: (...args) => calls.pointers.push(args),
    },
    '../lib/useUserProfile': { useUserProfile: () => ({ profile: { plan: 'pro' } }) },
  }).default;
  const render = () => { index = 0; return Component(); };
  const nodes = (element) => {
    if (!element || typeof element !== 'object') return [];
    if (Array.isArray(element)) return element.flatMap(nodes);
    return [element, ...nodes(element.props?.children)];
  };
  nodes(render()).find((node) => node.props?.['data-tour']).props.onClick();
  const switchTo = (id) => {
    const target = nodes(render()).find((node) => node.type === 'button'
      && nodes(node.props.children).some((child) => child.props?.title === id));
    assert.ok(target, `Missing session row: ${id}`);
    return target.props.onClick();
  };
  return { store, calls, switchTo };
}

const olderTranscript = [
  { id: 'old-u', role: 'user', text: 'Who wrote the paper?', createdAt: 1, backendId: 'old-u' },
  { id: 'old-a', role: 'assistant', text: 'Vaswani et al.', citations: [], createdAt: 2, backendId: 'old-a' },
];

test('switching conversations publishes the new id only together with its transcript', async () => {
  const transcript = deferred();
  const h = dropdownHarness({ getMessages: () => transcript.promise });
  const watcher = watchLikeChatPanelAutoSubmit(h.store);
  const switching = h.switchTo('older');
  await settle();
  assert.equal(h.store.getState().sessionId, 'current', 'the previous conversation stays until the new one has loaded');
  assert.deepEqual(h.store.getState().messages, earlier);
  transcript.resolve({ messages: olderTranscript });
  await switching;
  await settle();

  assert.deepEqual(watcher.seen, [{ sessionId: 'older', messages: olderTranscript }]);
  assert.equal(watcher.didSubmit(), false);
  assert.equal(h.store.getState().sessionId, 'older');
  assert.deepEqual(h.store.getState().messages, olderTranscript);
});

test('the last conversation clicked wins, with its own transcript', async () => {
  const pending = { older: deferred(), oldest: deferred() };
  const h = dropdownHarness({ getMessages: (id) => pending[id].promise });
  const first = h.switchTo('older');
  const second = h.switchTo('oldest');
  const oldestTranscript = [{ id: 'oldest-u', role: 'user', text: 'Oldest question', createdAt: 1 }];
  pending.oldest.resolve({ messages: oldestTranscript });
  await second;
  pending.older.resolve({ messages: olderTranscript });
  await first;

  assert.equal(h.store.getState().sessionId, 'oldest');
  assert.deepEqual(h.store.getState().messages, oldestTranscript);
});

test('a send on the conversation still on screen cancels the pending switch', async () => {
  const transcript = deferred();
  const h = dropdownHarness({ getMessages: () => transcript.promise });
  const switching = h.switchTo('older');
  await settle();
  h.store.getState().setStreaming(true);
  transcript.resolve({ messages: olderTranscript });
  await switching;

  assert.equal(h.store.getState().sessionId, 'current');
  assert.deepEqual(h.store.getState().messages, earlier);
});

test('switching to an anonymous demo conversation installs its accounting with its transcript', async () => {
  const h = dropdownHarness({ isDemo: true, getMessages: async () => ({ messages: olderTranscript, demo_messages_used: 3 }) });
  await h.switchTo('older');

  assert.deepEqual(h.calls.accounting, [
    ['setDemoRestoredUserMsgCount', 'older', 1],
    ['setDemoMessagesUsed', 'older', 3],
    ['bumpDemoAccountingEpoch', 'older'],
  ]);
  assert.deepEqual(h.calls.pointers, [['doc-1', 'older']]);
});
