const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function settlePromises() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function createStore(overrides = {}) {
  const state = {
    sessionId: 'session-a',
    messages: [],
    isStreaming: false,
    demoMessagesUsed: 0,
    demoRestoredUserMsgCount: 0,
    demoAccountingEpoch: 0,
    domainMode: null,
    activityUpdates: 0,
    addMessage(message) {
      state.messages = [...state.messages, message];
    },
    updateLastMessage(text) {
      const last = state.messages.at(-1);
      if (last) state.messages = [...state.messages.slice(0, -1), { ...last, text }];
    },
    addCitationToLastMessage() {},
    addArtifactToLastMessage() {},
    setLastMessageToolStatus() {},
    setStreaming(value) {
      state.isStreaming = value;
    },
    updateSessionActivity() {
      state.activityUpdates += 1;
    },
    flushPendingText() {},
    markLastMessageTruncated(value) {
      const last = state.messages.at(-1);
      if (last) state.messages = [...state.messages.slice(0, -1), { ...last, isTruncated: value }];
    },
    updateLastMessageMeta(updates) {
      const last = state.messages.at(-1);
      if (last) state.messages = [...state.messages.slice(0, -1), { ...last, ...updates }];
    },
    setMessages(messages) {
      state.messages = messages;
    },
    setDemoMessagesUsed(value) {
      state.demoMessagesUsed = value;
    },
    setDemoRestoredUserMsgCount(value) {
      state.demoRestoredUserMsgCount = value;
    },
    bumpDemoAccountingEpoch() {
      state.demoAccountingEpoch += 1;
    },
    ...overrides,
  };

  const useDocTalkStore = () => state;
  useDocTalkStore.getState = () => state;
  return { state, useDocTalkStore };
}

function loadUseChatStream({ store, chatStream, continueStream, getMessages, calls }) {
  const filename = path.resolve(__dirname, '../src/lib/useChatStream.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const chatModule = new Module(filename, module);
  chatModule.filename = filename;
  chatModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = chatModule.require.bind(chatModule);
  chatModule.require = (request) => {
    if (request === 'react') {
      return {
        useCallback: (fn) => fn,
        useMemo: (factory) => factory(),
        useRef: (initial) => ({ current: initial }),
      };
    }
    if (request === './sse') return { chatStream, continueStream };
    if (request === './api') return { getMessages };
    if (request === '../store') return { useDocTalkStore: store };
    if (request === '../components/CreditsDisplay') {
      return { triggerCreditsRefresh: () => { calls.creditRefreshes += 1; } };
    }
    if (request === './errorCopy') return { errorCopy: () => ({ body: 'error' }) };
    if (request === './analytics') {
      return { trackEvent: (name) => calls.events.push(name) };
    }
    if (request === './shareAnchors') {
      return { messageShareAnchorFromId: (id) => `anchor-${id}` };
    }
    if (request === './billingLinks') return { deriveUpgradePlan: () => 'plus' };
    return realRequire(request);
  };
  chatModule._compile(compiled, filename);
  return chatModule.exports.useChatStream;
}

function createHarness({ initialState, chatStream, continueStream, getMessages }) {
  const { state, useDocTalkStore } = createStore(initialState);
  const calls = { creditRefreshes: 0, events: [] };
  const useChatStream = loadUseChatStream({
    store: useDocTalkStore,
    chatStream,
    continueStream: continueStream || (async () => {}),
    getMessages,
    calls,
  });
  const render = () => useChatStream({
    sessionId: 'session-a',
    selectedMode: 'quick',
    locale: 'en',
    t: (key) => key,
    tOr: (_key, fallback) => fallback,
    maxUserMessages: 5,
    onShowPaywall: () => {},
    onRequireAuth: () => {},
  });
  return { state, calls, render };
}

function abortableStream(started) {
  return async (...args) => {
    const signal = args[9];
    await new Promise((resolve) => {
      signal.addEventListener('abort', resolve, { once: true });
      started.resolve();
    });
  };
}

test('Stop re-anchors an initial demo send to the released server count', async () => {
  const started = deferred();
  let getMessagesCalls = 0;
  const harness = createHarness({
    chatStream: abortableStream(started),
    getMessages: async () => {
      getMessagesCalls += 1;
      return { messages: [], demo_messages_used: 0 };
    },
  });
  const stream = harness.render();

  const send = stream.sendMessage('Where is the evidence?');
  await started.promise;
  stream.stopStreaming();
  await send;
  await settlePromises();

  assert.equal(getMessagesCalls, 1);
  assert.equal(harness.state.demoMessagesUsed, 0);
  assert.equal(harness.state.demoRestoredUserMsgCount, 1);
  assert.equal(harness.render().messagesUsed, 0);
});

test('pre-header abort rejection leaves Stop as the only re-anchor writer', async () => {
  const started = deferred();
  let getMessagesCalls = 0;
  const harness = createHarness({
    chatStream: async (...args) => {
      const signal = args[9];
      started.resolve();
      await new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })),
          { once: true },
        );
      });
    },
    getMessages: async () => {
      getMessagesCalls += 1;
      return { messages: [], demo_messages_used: 0 };
    },
  });
  const stream = harness.render();

  const send = stream.sendMessage('Abort before response headers');
  await started.promise;
  stream.stopStreaming();
  await send;
  await settlePromises();

  assert.equal(getMessagesCalls, 1);
  assert.equal(harness.render().messagesUsed, 0);
});

test('Stop re-anchors an optimistic regenerate increment to server truth', async () => {
  const started = deferred();
  const harness = createHarness({
    initialState: {
      messages: [
        { id: 'u1', role: 'user', text: 'Question', createdAt: 1 },
        { id: 'a1', role: 'assistant', text: 'Answer', createdAt: 2 },
      ],
      demoMessagesUsed: 1,
      demoRestoredUserMsgCount: 1,
    },
    chatStream: abortableStream(started),
    getMessages: async () => ({ messages: [], demo_messages_used: 1 }),
  });
  const stream = harness.render();

  const regenerate = stream.regenerateLastResponse();
  await started.promise;
  assert.equal(harness.state.demoMessagesUsed, 2);
  stream.stopStreaming();
  await regenerate;
  await settlePromises();

  assert.equal(harness.state.demoMessagesUsed, 1);
  assert.equal(harness.state.demoRestoredUserMsgCount, 1);
  assert.equal(harness.render().messagesUsed, 1);
});

test('clean EOF is truncated, re-anchors, and never runs success side effects', async () => {
  let getMessagesCalls = 0;
  const harness = createHarness({
    chatStream: async (...args) => {
      const onDone = args[5];
      const onTruncated = args[6];
      onTruncated();
      onDone({ message_id: '' });
    },
    getMessages: async () => {
      getMessagesCalls += 1;
      return { messages: [], demo_messages_used: 0 };
    },
  });

  await harness.render().sendMessage('Question cut off by proxy');
  await settlePromises();

  assert.equal(getMessagesCalls, 1);
  assert.equal(harness.state.messages.at(-1).isTruncated, true);
  assert.equal(harness.state.activityUpdates, 0);
  assert.equal(harness.calls.creditRefreshes, 0);
  assert.equal(harness.calls.events.includes('chat_message_completed'), false);
  assert.equal(harness.render().messagesUsed, 0);
});

for (const guard of ['session', 'epoch']) {
  test(`late clean-EOF re-anchor is dropped by the ${guard} guard`, async () => {
    const snapshot = deferred();
    const requested = deferred();
    const harness = createHarness({
      initialState: { demoMessagesUsed: 2 },
      chatStream: async (...args) => {
        args[6]();
        args[5]({ message_id: '' });
      },
      getMessages: async () => {
        requested.resolve();
        return snapshot.promise;
      },
    });

    await harness.render().sendMessage('Truncated attempt');
    await requested.promise;
    if (guard === 'session') harness.state.sessionId = 'session-b';
    if (guard === 'epoch') harness.state.bumpDemoAccountingEpoch();
    snapshot.resolve({ messages: [], demo_messages_used: 0 });
    await settlePromises();

    assert.equal(harness.state.demoMessagesUsed, 2);
    assert.equal(harness.state.demoRestoredUserMsgCount, 0);
  });
}

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
