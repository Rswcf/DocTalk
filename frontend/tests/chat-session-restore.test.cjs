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

class ApiError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}

function runUseChatSession(store, api, demoStorage = {}) {
  const effects = [];
  const react = {
    useState(initial) { return [initial, () => {}]; },
    useEffect(fn) { effects.push(fn); },
  };
  const useStore = (selector) => selector ? selector(store.getState()) : store.getState();
  useStore.getState = store.getState;
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
function dropdownHarness({ getMessages, createSession, deleteSession, isDemo = false }) {
  const store = createStore();
  const state = store.getState();
  state.setIsDemo(isDemo);
  state.setSessions([row('current', 2), row('older', 2), row('oldest', 2)]);
  state.setSessionId('current');
  state.setMessages(earlier);
  const calls = { pointers: [], accounting: [], deleted: [] };
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
      createSession: createSession || (async () => { throw new Error('not under test'); }),
      getMessages,
      deleteSession: async (id) => { calls.deleted.push(id); if (deleteSession) await deleteSession(id); },
    },
    '../lib/errorCopy': { errorCopy: () => ({ body: 'error' }) },
    '../lib/analytics': { trackEvent() {} },
    '../lib/billing': { startPlanAwareBillingAction: async () => {}, getBillingErrorMessage: () => '' },
    '../lib/useDropdownKeyboard': { useDropdownKeyboard: () => () => {} },
    '../lib/demoSessionStorage': {
      clearDemoSession() {}, readDemoSession: () => null,
      writeDemoSession: (...args) => calls.pointers.push(args),
    },
    '../lib/singleFlight': load('lib/singleFlight.ts'),
    '../lib/useUserProfile': { useUserProfile: () => ({ profile: { plan: 'pro' } }) },
  }).default;
  const render = () => { index = 0; return Component(); };
  const nodes = (element) => {
    if (!element || typeof element !== 'object') return [];
    if (Array.isArray(element)) return element.flatMap(nodes);
    return [element, ...nodes(element.props?.children)];
  };
  nodes(render()).find((node) => node.props?.['data-tour']).props.onClick();
  const textOf = (element) => {
    if (element == null || typeof element === 'boolean') return '';
    if (Array.isArray(element)) return element.map(textOf).join('');
    if (typeof element !== 'object') return String(element);
    return textOf(element.props?.children);
  };
  const click = (label, event) => {
    const target = nodes(render()).find((node) => node.type === 'button' && textOf(node).trim() === label);
    assert.ok(target, `Missing button: ${label}`);
    return target.props.onClick(event);
  };
  const switchTo = (id) => {
    const target = nodes(render()).find((node) => node.type === 'button'
      && nodes(node.props.children).some((child) => child.props?.title === id));
    assert.ok(target, `Missing session row: ${id}`);
    return target.props.onClick();
  };
  const rowButton = (id, label) => {
    const row = nodes(render()).findLast((node) => node.type === 'div'
      && Array.isArray(node.props?.children)
      && nodes(node.props.children).some((child) => child.props?.title === id));
    assert.ok(row, `Missing session row: ${id}`);
    const target = nodes(row.props.children).find((node) => node.type === 'button'
      && (node.props['aria-label'] === label || textOf(node).trim() === label));
    assert.ok(target, `Missing ${label} in row ${id}`);
    return target.props.onClick({ stopPropagation() {} });
  };
  const isOpen = () => nodes(render()).some((node) => node.props?.role === 'menu');
  const alertShown = () => nodes(render()).some((node) => node.props?.role === 'alert');
  return { store, calls, switchTo, click, rowButton, isOpen, alertShown };
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

test('a second conversation clicked while the first one loads is ignored', async () => {
  const pending = { older: deferred(), oldest: deferred() };
  const fetched = [];
  const h = dropdownHarness({ getMessages: (id) => { fetched.push(id); return pending[id].promise; } });
  const first = h.switchTo('older');
  await h.switchTo('oldest');
  pending.older.resolve({ messages: olderTranscript });
  await first;

  assert.deepEqual(fetched, ['older']);
  assert.equal(h.store.getState().sessionId, 'older');
  assert.deepEqual(h.store.getState().messages, olderTranscript);
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

// Codex r1 (MAJOR): a New Chat and a pending switch must never both publish
// (r1 fixed it with a shared ordinal; r2 replaced that with the latch).
test('a New Chat clicked while a switch is loading is ignored', async () => {
  const transcript = deferred();
  const created = [];
  const h = dropdownHarness({
    isDemo: true,
    getMessages: () => transcript.promise,
    createSession: async () => { created.push('create'); return { session_id: 'fresh', created_at: '2026-10-11', demo_messages_used: 2 }; },
  });
  const switching = h.switchTo('older');
  await settle();
  await h.click('session.newChat');
  transcript.resolve({ messages: olderTranscript, demo_messages_used: 2 });
  await switching;

  assert.deepEqual(created, []);
  assert.equal(h.store.getState().sessionId, 'older');
  assert.deepEqual(h.store.getState().messages, olderTranscript);
  assert.deepEqual(h.calls.pointers, [['doc-1', 'older']], 'one action, one pointer move');
});

// Codex r1 (MAJOR): the deleted conversation must not stay live while its
// replacement loads — a send there would strand the reader on it.
test('deleting the open conversation unpublishes it before the replacement loads', async () => {
  const transcript = deferred();
  const h = dropdownHarness({ getMessages: (id) => { assert.equal(id, 'older'); return transcript.promise; } });
  h.click('session.deleteChat');
  const deleting = h.click('common.yes');
  await settle();
  assert.deepEqual(h.calls.deleted, ['current']);
  assert.equal(h.store.getState().sessionId, null, 'the deleted conversation is still published');
  assert.deepEqual(h.store.getState().messages, []);
  transcript.resolve({ messages: olderTranscript });
  await deleting;

  assert.equal(h.store.getState().sessionId, 'older');
  assert.deepEqual(h.store.getState().messages, olderTranscript);
});

test('a failed replacement fetch after deleting the open conversation never re-publishes it', async () => {
  const h = dropdownHarness({ getMessages: async () => { throw new Error('network'); } });
  h.click('session.deleteChat');
  await assert.rejects(h.click('common.yes'), /network/);

  assert.equal(h.store.getState().sessionId, null);
  assert.deepEqual(h.store.getState().messages, []);
});

// Codex r1 (MINOR): the start-up restore must not overwrite a conversation the
// user already opened from the dropdown while the first transcript loaded.
test('a conversation opened while the start-up transcript loads is kept', async () => {
  const picked = [{ id: 'p-u', role: 'user', text: 'Picked by hand', createdAt: 5 }];
  for (const branch of ['reuse', 'adoption']) {
    const store = createStore();
    const transcript = deferred();
    runUseChatSession(store, {
      listSessions: async () => ({ sessions: [row('latest', 2), row('picked', 1)] }),
      getMessages: () => transcript.promise,
      createSession: async () => { throw new Error('must not create'); },
    }, branch === 'adoption' ? { readDemoSession: () => 'stored' } : {});
    await settle();
    store.getState().setSessionId('picked');
    store.getState().setMessages(picked);
    transcript.resolve({ messages: earlier, demo_messages_used: 1 });
    await settle();

    assert.equal(store.getState().sessionId, 'picked', branch);
    assert.deepEqual(store.getState().messages, picked, branch);
  }
});

// Codex r2: session-menu actions run one at a time (the project's
// single-flight latch), so no action can resume over another one.
test('a switch clicked while a New Chat is being created is ignored', async () => {
  const created = deferred();
  const fetched = [];
  const h = dropdownHarness({
    getMessages: async (id) => { fetched.push(id); return { messages: olderTranscript }; },
    createSession: () => created.promise,
  });
  const watcher = watchLikeChatPanelAutoSubmit(h.store);
  const creating = h.click('session.newChat');
  await h.switchTo('older');
  created.resolve({ session_id: 'fresh', created_at: '2026-10-11' });
  await creating;
  await settle();

  assert.deepEqual(fetched, [], 'the switch must not run while New Chat is pending');
  assert.deepEqual(watcher.seen.map((s) => s.sessionId), ['fresh']);
  assert.equal(h.store.getState().sessionId, 'fresh');
});

test('a conversation clicked while it is being deleted is never opened', async () => {
  const deleted = deferred();
  const fetched = [];
  const h = dropdownHarness({
    getMessages: async (id) => { fetched.push(id); return { messages: olderTranscript }; },
    deleteSession: () => deleted.promise,
  });
  h.rowButton('older', 'session.deleteChat');
  const deleting = h.rowButton('older', 'common.yes');
  await settle();
  await h.switchTo('older');
  deleted.resolve();
  await deleting;
  await settle();

  assert.deepEqual(fetched, []);
  assert.equal(h.store.getState().sessionId, 'current');
  assert.deepEqual(h.store.getState().messages, earlier);
  assert.deepEqual(h.store.getState().sessions.map((s) => s.session_id), ['current', 'oldest']);
});

test('a failed start-up transcript fetch never replaces a conversation opened from the menu', async () => {
  const store = createStore();
  const transcript = deferred();
  const created = [];
  runUseChatSession(store, {
    listSessions: async () => ({ sessions: [row('latest', 2), row('picked', 1)] }),
    getMessages: () => transcript.promise,
    createSession: async () => { created.push('create'); return { session_id: 'fresh', created_at: '2026-10-11' }; },
  });
  await settle();
  store.getState().setSessionId('picked');
  store.getState().setMessages(olderTranscript);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    transcript.reject(new Error('network'));
    await settle();
    await settle();
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(created, []);
  assert.equal(store.getState().sessionId, 'picked');
  assert.deepEqual(store.getState().messages, olderTranscript);
});

test('a stale demo adoption never clears the pointer a New Chat moved meanwhile', async () => {
  const store = createStore();
  const transcript = deferred();
  let pointer = 'stored';
  const listed = [];
  runUseChatSession(store, {
    listSessions: async () => { listed.push('list'); return { sessions: [] }; },
    getMessages: () => transcript.promise,
    createSession: async () => { throw new Error('must not create'); },
  }, {
    readDemoSession: () => pointer,
    writeDemoSession: (_doc, id) => { pointer = id; },
    clearDemoSession: () => { pointer = null; },
  });
  await settle();
  // New Chat from the menu while the adoption GET is in flight.
  store.getState().setSessionId('fresh');
  pointer = 'fresh';
  transcript.reject(new ApiError(404));
  await settle();

  assert.equal(pointer, 'fresh');
  assert.equal(store.getState().sessionId, 'fresh');
  assert.deepEqual(listed, []);
});

// Codex r3 (R): the header keeps SessionDropdown mounted across documents, so
// a menu request stalled on one document must not lock the menu on the next.
test('a menu action stalled on one document does not lock the menu on the next', async () => {
  const created = [];
  const h = dropdownHarness({
    getMessages: () => new Promise(() => {}),
    createSession: async (docId) => { created.push(docId); return { session_id: 'd2-fresh', created_at: '2026-10-11' }; },
  });
  void h.switchTo('older');
  await settle();
  const state = h.store.getState();
  state.setDocument('doc-2');
  state.setDocumentStatus('ready');
  state.setSessions([row('d2-current', 1)]);
  state.setSessionId('d2-current');
  await h.click('session.newChat');

  assert.deepEqual(created, ['doc-2']);
  assert.equal(h.store.getState().sessionId, 'd2-fresh');
});

// Codex r3 (P), pre-existing on main: New Chat and delete-current checked for
// a running stream only when they started. The local writes of
// useChatStream.sendMessage, and its stream's later callbacks: every one is
// dropped once the store's session id or demo accounting epoch is no longer
// the one the send started on (`active()`), its `done` included, so a session
// change under a running stream leaves isStreaming set.
function startStreamLikeSendMessage(store) {
  const state = store.getState();
  const sessionId = state.sessionId;
  const epoch = state.demoAccountingEpoch;
  const active = () => store.getState().sessionId === sessionId && store.getState().demoAccountingEpoch === epoch;
  state.addMessage({ id: 'send-u', role: 'user', text: QUESTION, createdAt: 20 });
  state.addMessage({ id: 'send-a', role: 'assistant', text: '', citations: [], createdAt: 20 });
  state.setStreaming(true);
  if (active()) store.getState().updateLastMessage(ANSWER);
  return {
    // handleStreamDone: flush the buffered text, then clear the flag.
    done() {
      if (!active()) return;
      store.getState().flushPendingText();
      store.getState().setStreaming(false);
    },
  };
}

// The store buffers streamed text and appends it to the LAST message 50 ms
// later, whatever transcript is on screen by then.
const afterTextFlush = () => new Promise((resolve) => setTimeout(resolve, 80));

test('a send during a pending New Chat keeps its conversation and its stream', async () => {
  const created = deferred();
  const h = dropdownHarness({
    isDemo: true,
    getMessages: async () => { throw new Error('not under test'); },
    createSession: () => created.promise,
  });
  const creating = h.click('session.newChat');
  await settle();
  const stream = startStreamLikeSendMessage(h.store);
  created.resolve({ session_id: 'fresh', created_at: '2026-10-11', demo_messages_used: 2 });
  await creating;
  stream.done();
  await afterTextFlush();

  const state = h.store.getState();
  assert.equal(state.sessionId, 'current');
  assert.deepEqual(state.messages.map((m) => [m.id, m.text]), [
    ...earlier.map((m) => [m.id, m.text]),
    ['send-u', QUESTION],
    ['send-a', ANSWER],
  ]);
  assert.equal(state.isStreaming, false, 'the stream ended but isStreaming is still set');
  assert.deepEqual(h.calls.pointers, [], 'the demo pointer moved to a conversation that was never opened');
  assert.deepEqual(h.calls.accounting, [], 'demo accounting installed for a conversation that was never opened');
  assert.deepEqual(state.sessions.map((s) => s.session_id), ['fresh', 'current', 'older', 'oldest'],
    'the created conversation exists on the server, so the menu lists it');
});

// Deleting the open conversation: the server row is already gone when the
// request returns, so a stream started on it meanwhile has nowhere to land.
// The delete goes ahead and ends that stream locally.
test('a send during the delete of the open conversation never leaves the reader streaming', async () => {
  for (const branch of ['replacement', 'none left']) {
    const deleted = deferred();
    const h = dropdownHarness({
      getMessages: async (id) => { assert.equal(id, 'older', branch); return { messages: olderTranscript }; },
      createSession: async () => ({ session_id: 'fresh', created_at: '2026-10-11' }),
      deleteSession: () => deleted.promise,
    });
    if (branch === 'none left') h.store.getState().setSessions([row('current', 2)]);
    h.click('session.deleteChat');
    const deleting = h.click('common.yes');
    await settle();
    const stream = startStreamLikeSendMessage(h.store);
    deleted.resolve();
    await deleting;
    stream.done();
    await afterTextFlush();

    const state = h.store.getState();
    assert.equal(state.isStreaming, false, `${branch}: isStreaming is still set`);
    assert.equal(state.sessionId, branch === 'replacement' ? 'older' : 'fresh', branch);
    assert.deepEqual(state.messages, branch === 'replacement' ? olderTranscript : [],
      `${branch}: the deleted conversation's stream wrote into the replacement`);
  }
});

// Codex r4: with one latch per document, a menu request from document A can
// resolve while the menu is open on document B. Every action must then leave
// B alone: its session, transcript, list, demo accounting and pointer, the
// menu's error copy and its open state.
test('a menu action that resolves after a document switch leaves the next document untouched', async () => {
  const secondTranscript = [{ id: 'd2-u', role: 'user', text: 'Second document question', createdAt: 7 }];
  const cases = {
    switch: (pending) => ({ getMessages: () => pending.promise, act: (h) => h.switchTo('older'), settle: (p) => p.resolve({ messages: olderTranscript, demo_messages_used: 2 }) }),
    'new chat': (pending) => ({ createSession: () => pending.promise, act: (h) => h.click('session.newChat'), settle: (p) => p.resolve({ session_id: 'fresh', created_at: '2026-10-11', demo_messages_used: 2 }) }),
    'new chat error': (pending) => ({ createSession: () => pending.promise, act: (h) => h.click('session.newChat'), settle: (p) => p.reject(new Error('limit')) }),
    'delete other': (pending) => ({ deleteSession: () => pending.promise, act: (h) => { h.rowButton('older', 'session.deleteChat'); return h.rowButton('older', 'common.yes'); }, settle: (p) => p.resolve() }),
    'delete current': (pending) => ({ deleteSession: () => pending.promise, act: (h) => { h.click('session.deleteChat'); return h.click('common.yes'); }, settle: (p) => p.resolve() }),
  };
  for (const [name, make] of Object.entries(cases)) {
    const pending = deferred();
    const spec = make(pending);
    const h = dropdownHarness({
      isDemo: true,
      getMessages: spec.getMessages || (async () => ({ messages: olderTranscript })),
      createSession: spec.createSession,
      deleteSession: spec.deleteSession,
    });
    const running = spec.act(h);
    await settle();
    const state = h.store.getState();
    state.setDocument('doc-2');
    state.setDocumentStatus('ready');
    state.setSessions([row('d2-current', 1)]);
    state.setSessionId('d2-current');
    state.setMessages(secondTranscript);
    assert.ok(h.isOpen(), `${name}: the menu is open on the second document`);
    const callsBefore = { accounting: h.calls.accounting.length, pointers: h.calls.pointers.length };
    spec.settle(pending);
    await running;
    await settle();

    const after = h.store.getState();
    assert.equal(after.sessionId, 'd2-current', name);
    assert.deepEqual(after.messages, secondTranscript, name);
    assert.deepEqual(after.sessions.map((s) => s.session_id), ['d2-current'], name);
    assert.equal(h.calls.accounting.length, callsBefore.accounting, `${name}: demo accounting written on the second document`);
    assert.equal(h.calls.pointers.length, callsBefore.pointers, `${name}: demo pointer moved on the second document`);
    assert.equal(h.alertShown(), false, `${name}: the first document's error shows on the second`);
    assert.ok(h.isOpen(), `${name}: the first document's action closed the menu on the second`);
  }
});
