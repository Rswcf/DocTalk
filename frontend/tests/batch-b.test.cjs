const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function loadBriefEmptyStateModule() {
  const filename = path.resolve(__dirname, '../src/lib/documentBriefEmptyState.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

function loadSingleFlightModule() {
  const filename = path.resolve(__dirname, '../src/lib/singleFlight.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

function loadTypeScriptModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));

  const originalLoad = Module._load;
  Module._load = function loadWithMocks(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    loaded._compile(compiled, filename);
  } finally {
    Module._load = originalLoad;
  }
  return loaded.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHookRuntime() {
  const slots = [];
  let hookIndex = 0;
  let pendingEffects = [];

  const sameDependencies = (left, right) => (
    Boolean(left)
    && Boolean(right)
    && left.length === right.length
    && left.every((value, index) => Object.is(value, right[index]))
  );

  const react = {
    useState(initialValue) {
      const index = hookIndex;
      hookIndex += 1;
      if (!slots[index]) {
        const slot = {
          value: typeof initialValue === 'function' ? initialValue() : initialValue,
        };
        slot.setValue = (nextValue) => {
          slot.value = typeof nextValue === 'function' ? nextValue(slot.value) : nextValue;
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].setValue];
    },
    useRef(initialValue) {
      const index = hookIndex;
      hookIndex += 1;
      if (!slots[index]) slots[index] = { current: initialValue };
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = hookIndex;
      hookIndex += 1;
      const slot = slots[index];
      if (!slot || !sameDependencies(slot.dependencies, dependencies)) {
        slots[index] = { callback, dependencies };
      }
      return slots[index].callback;
    },
    useEffect(effect, dependencies) {
      const index = hookIndex;
      hookIndex += 1;
      const slot = slots[index];
      if (!slot || !sameDependencies(slot.dependencies, dependencies)) {
        pendingEffects.push({ effect, index });
        slots[index] = { ...slot, dependencies };
      }
    },
  };

  return {
    react,
    render(renderHook) {
      hookIndex = 0;
      pendingEffects = [];
      const result = renderHook();
      for (const { effect, index } of pendingEffects) {
        slots[index].cleanup?.();
        slots[index].cleanup = effect();
      }
      return result;
    },
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createChatHookHarness({ chatStream, initialMessages, maxUserMessages, getMessages, continueStream }) {
  const metrics = {
    accountingEpochBumps: 0,
    demoUsageWrites: 0,
    reanchorRequests: 0,
    paywalls: 0,
    events: [],
  };
  const state = {
    sessionId: 'session-1',
    messages: initialMessages.map((message) => ({ ...message })),
    isStreaming: false,
    demoMessagesUsed: 0,
    demoRestoredUserMsgCount: initialMessages.filter((message) => message.role === 'user').length,
    demoAccountingEpoch: 0,
    domainMode: null,
  };

  state.addMessage = (message) => {
    state.messages = [...state.messages, message];
  };
  state.setMessages = (messages) => {
    state.messages = messages;
  };
  state.updateLastMessage = (text) => {
    const last = state.messages[state.messages.length - 1];
    if (last) state.messages = [...state.messages.slice(0, -1), { ...last, text: `${last.text || ''}${text}` }];
  };
  state.addCitationToLastMessage = () => {};
  state.addArtifactToLastMessage = () => {};
  state.setLastMessageToolStatus = () => {};
  state.setStreaming = (value) => {
    state.isStreaming = value;
  };
  state.updateSessionActivity = () => {};
  state.flushPendingText = () => {};
  state.markLastMessageTruncated = (value) => {
    const last = state.messages[state.messages.length - 1];
    if (last) state.messages = [...state.messages.slice(0, -1), { ...last, isTruncated: value }];
  };
  state.updateLastMessageMeta = (updates) => {
    const last = state.messages[state.messages.length - 1];
    if (last) state.messages = [...state.messages.slice(0, -1), { ...last, ...updates }];
  };
  state.setDemoMessagesUsed = (value) => {
    metrics.demoUsageWrites += 1;
    state.demoMessagesUsed = value;
  };
  state.setDemoRestoredUserMsgCount = (value) => {
    state.demoRestoredUserMsgCount = value;
  };
  state.bumpDemoAccountingEpoch = () => {
    metrics.accountingEpochBumps += 1;
    state.demoAccountingEpoch += 1;
  };

  const useDocTalkStore = () => state;
  useDocTalkStore.getState = () => state;
  const react = {
    useCallback: (callback) => callback,
    useMemo: (factory) => factory(),
    useRef: (initialValue) => ({ current: initialValue }),
  };
  const { acquireSingleFlight } = loadSingleFlightModule();
  const hookModule = loadTypeScriptModule(
    path.resolve(__dirname, '../src/lib/useChatStream.ts'),
    {
      react,
      './sse': { chatStream, continueStream: continueStream || (async () => {}) },
      './api': {
        getMessages: async () => {
          metrics.reanchorRequests += 1;
          if (getMessages) return getMessages();
          return { messages: state.messages, demo_messages_used: state.demoMessagesUsed };
        },
      },
      '../store': { useDocTalkStore },
      '../components/CreditsDisplay': { triggerCreditsRefresh: () => {} },
      './errorCopy': { errorCopy: () => ({ body: 'Retryable network error' }) },
      './analytics': { trackEvent: (name) => metrics.events.push(name) },
      './shareAnchors': { messageShareAnchorFromId: (id) => id },
      './billingLinks': { deriveUpgradePlan: () => 'plus' },
      './singleFlight': { acquireSingleFlight },
    },
  );
  const hook = hookModule.useChatStream({
    sessionId: state.sessionId,
    selectedMode: 'quick',
    locale: 'en',
    t: (key) => key,
    tOr: (_key, fallback) => fallback,
    maxUserMessages,
    onShowPaywall: () => { metrics.paywalls++; },
    onRequireAuth: () => {},
  });

  return { hook, metrics, state };
}

test('regenerate sends the original backend ID and adopts only the server current version', async () => {
  const old = [
    { id: 'q', backendId: 'question-id', role: 'user', text: 'What year?' },
    { id: 'a', backendId: 'answer-id', responseVersion: null, role: 'assistant', text: '2023' },
  ];
  const current = [old[0], { ...old[1], text: 'May 2023', responseVersion: 'version-2' }];
  let payload;
  const { hook, state } = createChatHookHarness({
    initialMessages: old,
    getMessages: async () => ({ messages: current }),
    chatStream: async (...args) => {
      payload = args[15];
      args[2]({ text: 'May 2023' });
      args[5]({ message_id: 'answer-id', response_version: 'version-2' });
    },
  });
  await hook.regenerateLastResponse();
  assert.deepEqual(payload, { regenerate_of: 'answer-id', expected_response_version: null });
  assert.equal(state.messages.filter(m => m.role === 'user').length, 1);
  assert.equal(state.messages.at(-1).responseVersion, 'version-2');
});

test('failed or aborted regenerate preserves the old answer while offline', async () => {
  for (const abort of [false, true]) {
    const old = [{ id: 'q', role: 'user', text: 'Question' }, { id: 'a', backendId: 'answer', role: 'assistant', text: 'Original answer' }];
    const { hook, state } = createChatHookHarness({
      initialMessages: old, getMessages: async () => { throw new Error('offline'); },
      chatStream: async (...args) => {
        args[2]({ text: 'Unfinished candidate' });
        if (!abort) throw new Error('network disconnected');
        await new Promise((resolve) => args[9].addEventListener('abort', resolve, { once: true }));
      },
    });
    const pending = hook.regenerateLastResponse();
    if (abort) hook.stopStreaming();
    await pending;
    assert.equal(state.messages.filter(m => m.role === 'user').length, 1);
    assert.ok(state.messages.some(m => m.text === 'Original answer'));
    assert.ok(!state.messages.some(m => m.text.includes('Unfinished candidate')));
    assert.equal(state.isStreaming, false);
    assert.equal(state.messages.some(m => m.isError), !abort);
  }
});

test('late regenerate callbacks and restore cannot write into a switched conversation', async () => {
  let resolve, callbacks;
  const { hook, state } = createChatHookHarness({
    initialMessages: [{ id: 'q', role: 'user', text: 'Question' }, { id: 'a', backendId: 'answer', role: 'assistant', text: 'Old' }],
    chatStream: async (...args) => { callbacks = args; await new Promise(r => { resolve = r; }); },
  });
  const pending = hook.regenerateLastResponse();
  state.sessionId = 'session-2'; state.demoAccountingEpoch++;
  state.messages = [{ id: 'new', role: 'assistant', text: 'Other conversation' }];
  callbacks[2]({ text: 'Late token' }); callbacks[5]({ message_id: 'late-id' }); resolve();
  await pending;
  assert.deepEqual(state.messages, [{ id: 'new', role: 'assistant', text: 'Other conversation' }]);
});

test('generic regenerate cannot restart tool artifacts and retries unsaved questions explicitly', async () => {
  let calls = 0, payload;
  const tool = createChatHookHarness({ initialMessages: [{ id: 'q', role: 'user', text: 'Translate' }, { id: 'a', backendId: 'tool', role: 'assistant', text: 'Started', artifacts: [{ type: 'layout_translation' }] }], chatStream: async () => { calls++; } });
  await tool.hook.regenerateLastResponse(); assert.equal(calls, 0);
  const retry = createChatHookHarness({ initialMessages: [{ id: 'q', role: 'user', text: 'Unsaved question' }, { id: 'e', role: 'assistant', text: 'Failed', isError: true }], chatStream: async (...args) => { payload = args[15]; } });
  await retry.hook.regenerateLastResponse();
  assert.deepEqual(payload, { retry_latest_question: true, retry_after: null });
});

test('document brief empty pane renders for a summary without questions', () => {
  const { shouldRenderDocumentBriefEmptyState, truncateDocumentBriefSummary } = loadBriefEmptyStateModule();
  assert.equal(shouldRenderDocumentBriefEmptyState(0, [], 'A useful summary.', false), true);
  assert.equal(shouldRenderDocumentBriefEmptyState(1, [], 'A useful summary.', false), false);
  assert.equal(truncateDocumentBriefSummary(Array.from({ length: 61 }, () => 'word').join(' ')).split(/\s+/).length, 60);

  const chatPanel = fs.readFileSync(
    path.resolve(__dirname, '../src/components/Chat/ChatPanel.tsx'),
    'utf8',
  );
  assert.match(chatPanel, /\{showDocumentBriefEmptyState && \(/);
  assert.match(chatPanel, /\{briefSummary\}/);
  assert.match(chatPanel, /documentBrief\?\.status === 'ready'/);
  assert.match(chatPanel, /usableDocumentBrief\.key_points\.slice\(0, 3\)/);
  assert.doesNotMatch(chatPanel, /documentBrief\.key_points\.slice\(0, 3\)/);

  const reader = fs.readFileSync(
    path.resolve(__dirname, '../src/app/d/[documentId]/DocumentReaderPageClient.tsx'),
    'utf8',
  );
  assert.match(reader, /useDocumentBrief\(/);
  assert.match(reader, /documentBrief=\{documentBrief\}/);
  assert.doesNotMatch(reader, /DocumentBriefPanel/);
});

test('only chat-response failures expose existing regenerate as Retry', () => {
  const bubble = fs.readFileSync(
    path.resolve(__dirname, '../src/components/Chat/MessageBubble.tsx'),
    'utf8',
  );
  assert.match(bubble, /isAssistant && isError && message\.retryAction === 'regenerate' && onRegenerate && !isStreaming/);
  assert.match(bubble, /onClick=\{onRegenerate\}/);
  assert.match(bubble, /tOr\('chat\.retry', 'Retry'\)/);

  const stream = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/useChatStream.ts'),
    'utf8',
  );
  assert.equal((stream.match(/retryAction: 'regenerate'/g) || []).length, 2);

  const chatPanel = fs.readFileSync(
    path.resolve(__dirname, '../src/components/Chat/ChatPanel.tsx'),
    'utf8',
  );
  assert.doesNotMatch(chatPanel, /retryAction:/);
});

test('the same rendered Retry then Send callbacks share one admission gate', async () => {
  const pendingRequest = deferred();
  let requests = 0;
  const { hook, metrics } = createChatHookHarness({
    chatStream: async () => {
      requests += 1;
      await pendingRequest.promise;
    },
    initialMessages: [
      { id: 'user-1', role: 'user', text: 'Original question', createdAt: 1 },
      { id: 'assistant-1', role: 'assistant', text: 'Failed answer', isError: true, retryAction: 'regenerate', createdAt: 2 },
    ],
    maxUserMessages: 5,
  });

  const retry = hook.regenerateLastResponse();
  const sent = await hook.sendMessage('Composer text from the same render');

  assert.equal(sent, false);
  assert.equal(requests, 1);
  assert.equal(metrics.demoUsageWrites, 1);
  assert.equal(metrics.accountingEpochBumps, 1);
  pendingRequest.resolve();
  await retry;

  const stream = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/useChatStream.ts'),
    'utf8',
  );
  assert.equal((stream.match(/acquireSingleFlight\(/g) || []).length, 3);
  assert.equal((stream.match(/chatOperationLatchRef,/g) || []).length, 3);
  assert.match(stream, /useDocTalkStore\.getState\(\)\.isStreaming/);
});

test('rejected fetches clean up Send and Regenerate with one Retry bubble', async () => {
  for (const operation of ['send', 'regenerate']) {
    let requests = 0;
    const { hook, metrics, state } = createChatHookHarness({
      chatStream: async () => {
        requests += 1;
        throw new TypeError('fetch failed');
      },
      initialMessages: operation === 'send'
        ? []
        : [
            { id: 'user-1', role: 'user', text: 'Original question', createdAt: 1 },
            { id: 'assistant-1', role: 'assistant', text: 'Failed answer', isError: true, createdAt: 2 },
          ],
      maxUserMessages: operation === 'regenerate' ? 5 : undefined,
    });

    if (operation === 'send') {
      assert.equal(await hook.sendMessage('New question'), true);
    } else {
      await hook.regenerateLastResponse();
    }

    assert.equal(requests, 1, `${operation} request count`);
    assert.equal(metrics.reanchorRequests, operation === 'regenerate' ? 1 : 0);
    assert.equal(state.isStreaming, false, `${operation} streaming cleanup`);
    assert.equal(
      state.messages.filter((message) => (
        message.role === 'assistant'
        && message.isError
        && message.retryAction === 'regenerate'
      )).length,
      1,
      `${operation} Retry bubble count`,
    );
  }
});

test('user-aborted transport rejection stays silent', async () => {
  let requests = 0;
  const { hook, state } = createChatHookHarness({
    chatStream: async (...args) => {
      requests += 1;
      const signal = args[9];
      await new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const abortError = new Error('AbortError');
          abortError.name = 'AbortError';
          reject(abortError);
        }, { once: true });
      });
    },
    initialMessages: [],
    maxUserMessages: undefined,
  });

  const sending = hook.sendMessage('Question to abort');
  assert.equal(state.isStreaming, true);
  hook.stopStreaming();
  await sending;

  assert.equal(requests, 1);
  assert.equal(state.isStreaming, false);
  assert.equal(state.messages.some((message) => message.isError), false);
});

test('document brief polling responses are guarded by a switch token', () => {
  const hook = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/useDocumentBrief.ts'),
    'utf8',
  );
  assert.match(hook, /requestScopeRef\.current = \{ documentId, latestRequestOrdinal: 0 \}/);
  assert.match(hook, /beginLatestRequest\(scope, nextRequestOrdinalRef\)/);
  assert.match(hook, /isLatestRequest\(requestScopeRef\.current, ticket\)/);
  assert.match(hook, /pollAttemptsRef\.current \+= 1;[\s\S]*void refresh\(\);/);
  assert.doesNotMatch(hook, /void refresh\(\)\.catch/);
});

test('poll 19 empty cannot overwrite the rendered poll 20 ready brief', async () => {
  const latestRequest = loadTypeScriptModule(
    path.resolve(__dirname, '../src/lib/latestRequest.ts'),
  );
  const runtime = createHookRuntime();
  const requests = [];
  let activeInterval = null;
  const previousWindow = global.window;
  global.window = {
    setInterval(callback) {
      activeInterval = callback;
      return 1;
    },
    clearInterval() {
      activeInterval = null;
    },
  };

  try {
    const hookModule = loadTypeScriptModule(
      path.resolve(__dirname, '../src/lib/useDocumentBrief.ts'),
      {
        react: runtime.react,
        './api': {
          getDocumentBrief: () => {
            const request = deferred();
            requests.push(request);
            return request.promise;
          },
        },
        './latestRequest': latestRequest,
      },
    );
    const renderBrief = () => runtime.render(() => hookModule.useDocumentBrief('doc-1'));

    let rendered = renderBrief();
    assert.equal(requests.length, 1, 'initial brief request');
    requests[0].resolve({ status: 'empty' });
    await flushAsyncWork();
    rendered = renderBrief();
    assert.equal(rendered.brief.status, 'empty');

    for (let poll = 1; poll <= 20; poll += 1) {
      assert.equal(typeof activeInterval, 'function', `poll ${poll} timer`);
      activeInterval();
      rendered = renderBrief();
    }
    assert.equal(requests.length, 21, 'initial request plus 20 started polls');
    assert.equal(activeInterval, null, 'empty polling stops at the 20-request cap');

    requests[20].resolve({ status: 'ready', summary: 'Final brief' });
    await flushAsyncWork();
    rendered = renderBrief();
    assert.equal(rendered.brief.status, 'ready');

    requests[19].resolve({ status: 'empty' });
    await flushAsyncWork();
    rendered = renderBrief();
    assert.equal(rendered.brief.status, 'ready');
    assert.equal(rendered.brief.summary, 'Final brief');

    for (let poll = 1; poll <= 18; poll += 1) requests[poll].resolve({ status: 'empty' });
    await flushAsyncWork();
    rendered = renderBrief();
    assert.equal(rendered.brief.status, 'ready');
  } finally {
    global.window = previousWindow;
  }
});

test('dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap', () => {
  const dashboard = fs.readFileSync(
    path.resolve(__dirname, '../src/components/dashboard/DashboardPageClient.tsx'),
    'utf8',
  );
  assert.match(dashboard, /readyDocumentCount >= 1[\s\S]*profile\?\.stats\.total_messages \|\| 0\) >= 3/);
  assert.doesNotMatch(dashboard, /DASHBOARD_NUDGE_MAX_IMPRESSIONS/);
  assert.match(dashboard, /Pro answers without the monthly cap/);
});


test('continue preserves the response version needed by the next regenerate', async () => {
  let continuationVersion, regeneratePayload;
  const { hook, state } = createChatHookHarness({
    initialMessages: [{ id: 'q', role: 'user', text: 'Question' }, { id: 'a', backendId: 'answer', responseVersion: 'v1', role: 'assistant', text: 'Partial answer', isTruncated: true }],
    continueStream: async (...args) => {
      continuationVersion = args[14];
      args[5]({ message_id: 'answer', response_version: 'v2' });
    },
    chatStream: async (...args) => { regeneratePayload = args[15]; args[5]({ message_id: 'answer', response_version: 'v3' }); },
  });
  await hook.continueGenerating();
  assert.equal(continuationVersion, 'v1');
  assert.equal(state.messages.at(-1).responseVersion, 'v2');
  await hook.regenerateLastResponse();
  assert.equal(regeneratePayload.expected_response_version, 'v2');
});


test('regenerate keeps truncation and quote hints when server confirms the live version', async () => {
  const question = { id: 'q', role: 'user', text: 'Question' };
  const { hook, state } = createChatHookHarness({
    initialMessages: [question, { id: 'a', backendId: 'answer', responseVersion: 'v1', role: 'assistant', text: 'Old' }],
    chatStream: async (...args) => { args[5]({ message_id: 'answer', response_version: 'v2', can_continue: true, continuation_count: 1, quote_finder_hint: true, quote_finder_topic: 'Topic' }); },
    getMessages: async () => ({ messages: [question, { id: 'server-a', backendId: 'answer', responseVersion: 'v2', role: 'assistant', text: 'Saved candidate' }] }),
  });
  await hook.regenerateLastResponse();
  assert.equal(state.messages.at(-1).text, 'Saved candidate');
  assert.equal(state.messages.at(-1).isTruncated, true);
  assert.equal(state.messages.at(-1).quoteFinderHint, true);
  assert.equal(state.messages.at(-1).quoteFinderTopic, 'Topic');
});

test('a rejected regenerate opens the paywall once', async () => {
  const { hook, metrics } = createChatHookHarness({
    initialMessages: [{ id: 'q', role: 'user', text: 'Question' }, { id: 'a', backendId: 'answer', responseVersion: 'v1', role: 'assistant', text: 'Old' }],
    chatStream: async () => { throw { status: 402, code: 'INSUFFICIENT_CREDITS' }; },
  });
  await hook.regenerateLastResponse();
  assert.equal(metrics.paywalls, 1);
  assert.equal(metrics.events.filter(x => x === 'paywall_opened').length, 1);
});

test('first regenerate after a stopped ordinary answer recovers its saved ID before retrying', async () => {
  let payload;
  const q={id:'q',role:'user',text:'Question'};
  let reads=0;
  const {hook}=createChatHookHarness({
    initialMessages:[q,{id:'local',role:'assistant',text:'Saved partial'}],
    getMessages:async()=>({messages:[q,{id:'saved',backendId:'answer',responseVersion: reads++ ? 'v2' : null,role:'assistant',text:'Saved partial'}]}),
    chatStream:async(...args)=>{payload=args[15];args[5]({message_id:'answer',response_version:'v2'});},
  });
  await hook.regenerateLastResponse();
  assert.deepEqual(payload,{regenerate_of:'answer',expected_response_version:null});
});
