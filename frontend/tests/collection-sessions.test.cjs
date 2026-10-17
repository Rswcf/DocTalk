const test = require('node:test');
const assert = require('node:assert/strict');
require('./_load-ts.cjs');
const { createCollectionSessions } = require('../src/lib/collectionSessions.ts');
const { useDocTalkStore: store } = require('../src/store/index.ts');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const msg = id => [{ id, role: 'assistant', text: id, createdAt: 1 }];
const row = id => ({ session_id: id, title: null, message_count: 1, created_at: 'now', last_activity_at: 'now' });
function setup(overrides = {}) {
  store.getState().reset();
  store.setState({ sessionId: 'original', messages: msg('original'), sessions: [row('original')] });
  let active = true;
  const errors = [];
  let creates = 0;
  const controller = createCollectionSessions('C', {
    getState: store.getState, publish: store.setState,
    list: async () => ({ sessions: [row('A')] }),
    messages: async id => ({ messages: msg(id) }),
    create: async () => { ++creates; return { session_id: 'new', collection_id: 'C', title: null, created_at: 'now' }; },
    isCurrent: () => active, onError: value => errors.push(value), ...overrides,
  });
  return { controller, errors, leave: () => { active = false; }, creates: () => creates };
}
function pair(id) {
  assert.equal(store.getState().sessionId, id);
  assert.deepEqual(store.getState().messages, msg(id));
}
test('A/B reverse response order keeps latest identity and transcript atomic for subscribers', async () => {
  const a = deferred(), b = deferred();
  const { controller } = setup({ messages: id => (id === 'A' ? a : b).promise });
  const observed = [];
  const unsubscribe = store.subscribe(state => observed.push([state.sessionId, state.messages[0]?.id]));
  const first = controller.open('A'), second = controller.open('B');
  pair('original');
  b.resolve({ messages: msg('B') }); await second;
  a.resolve({ messages: msg('A') }); await first;
  pair('B');
  unsubscribe();
  assert.deepEqual(observed, [['B', 'B']]);
});
test('failed open keeps existing conversation and exposes a recoverable error', async () => {
  let fail = true;
  const { controller, errors } = setup({ messages: async id => { if (fail) throw Error('offline'); return { messages: msg(id) }; } });
  await controller.open('A'); pair('original'); assert.equal(errors.at(-1), true);
  fail = false; await controller.open('A'); pair('A'); assert.equal(errors.at(-1), false);
});
test('restore failure never creates a new conversation', async () => {
  const { controller, errors, creates } = setup({ messages: async () => { throw Error('offline'); } });
  await controller.initialize(); pair('original');
  assert.equal(creates(), 0); assert.equal(errors.at(-1), true);
});
test('list failure never creates and can be retried', async () => {
  let fail = true;
  const { controller, creates } = setup({ list: async () => { if (fail) throw Error('offline'); return { sessions: [row('A')] }; } });
  await controller.initialize(); pair('original'); assert.equal(creates(), 0);
  fail = false; await controller.initialize(); pair('A');
});
test('new chat invalidates pending restore and publishes empty transcript in same write', async () => {
  const pending = deferred();
  const { controller } = setup({ messages: () => pending.promise });
  const restoring = controller.initialize(); await Promise.resolve();
  await controller.newSession();
  assert.equal(store.getState().sessionId, 'new'); assert.deepEqual(store.getState().messages, []);
  pending.resolve({ messages: msg('A') }); await restoring;
  assert.equal(store.getState().sessionId, 'new'); assert.deepEqual(store.getState().messages, []);
});
test('selection while initial list is pending wins over late initialization', async () => {
  const pending = deferred();
  const { controller } = setup({ list: () => pending.promise });
  const restoring = controller.initialize(); await controller.open('B');
  pending.resolve({ sessions: [row('A')] }); await restoring; pair('B');
  assert.equal(store.getState().sessions[0].session_id, 'original');
});
test('workspace/account change discards pending restore, open, and creation responses', async () => {
  for (const action of ['initialize', 'open', 'newSession']) {
    const pending = deferred();
    const ctx = setup({ list: () => pending.promise, messages: () => pending.promise, create: () => pending.promise });
    const request = ctx.controller[action]('A');
    ctx.leave();
    store.setState({ sessionId: 'other', messages: msg('other') });
    pending.resolve({ sessions: [row('A')], messages: msg('A'), session_id: 'new', collection_id: 'C', created_at: 'now' });
    await request; pair('other');
    assert.equal(ctx.errors.at(-1), false);
  }
});
test('duplicate new actions are single flight and wrong collection responses fail closed', async () => {
  const pending = deferred(); let calls = 0;
  const { controller, errors } = setup({ create: () => { ++calls; return pending.promise; } });
  const request = controller.newSession(); await controller.newSession();
  assert.equal(calls, 1);
  pending.resolve({ session_id: 'foreign', collection_id: 'other', created_at: 'now' }); await request;
  pair('original'); assert.equal(errors.at(-1), true);
});
test('React effect cleanup/replay reactivates controller while discarding previous requests', async () => {
  const pending = deferred(); let calls = 0;
  const { controller } = setup({ list: () => ++calls === 1 ? pending.promise : Promise.resolve({ sessions: [row('B')] }) });
  const stale = controller.initialize(); controller.dispose(); controller.activate();
  await controller.initialize(); pair('B');
  pending.resolve({ sessions: [row('A')] }); await stale; pair('B');
});

const pageHarness = require('./_collection-page.cjs');
const settle = () => new Promise(resolve => setImmediate(resolve));
const pageApi = overrides => ({
  getCollection: async id => ({ id, name: id, documents: [] }),
  listCollectionSessions: async () => ({ sessions: [row('original'), row('A'), row('B')] }),
  getMessages: async id => ({ messages: msg(id) }),
  createCollectionSession: async () => ({ session_id: 'new', collection_id: 'C', created_at: 'now', title: null }),
  ...overrides,
});
async function mountPage(api) {
  setup(); const page = pageHarness(store, pageApi(api));
  page.render(); page.commit(); await settle(); page.render(); return page;
}
test('actual page Retry repeats failed historical selection and failed creation', async () => {
  let fail = true; const requested = [];
  const page = await mountPage({ getMessages: async id => {
    requested.push(id); if (id === 'A' && fail) throw Error('offline'); return { messages: msg(id) };
  } });
  await page.sessions().props.onSelectSession('A'); pair('original'); page.render();
  assert.ok(page.alert()); fail = false; await page.retry().props.onClick(); pair('A');
  assert.deepEqual(requested, ['original', 'A', 'A']);
  let creations = 0;
  const newPage = await mountPage({ createCollectionSession: async () => {
    if (++creations === 1) throw Error('offline');
    return { session_id: 'new', collection_id: 'C', title: null, created_at: 'now' };
  } });
  await newPage.sessions().props.onNewSession(); pair('original'); newPage.render();
  await newPage.retry().props.onClick(); assert.equal(creations, 2);
  assert.equal(store.getState().sessionId, 'new'); assert.deepEqual(store.getState().messages, []);
});
test('actual page callbacks discard reverse Open responses and hide old account before effects', async () => {
  const a = deferred(), b = deferred();
  const page = await mountPage({ getMessages: id => id === 'A' ? a.promise : id === 'B' ? b.promise : Promise.resolve({ messages: msg(id) }) });
  const open = page.sessions().props.onSelectSession;
  const first = open('A'), second = open('B');
  b.resolve({ messages: msg('B') }); await second;
  a.resolve({ messages: msg('A') }); await first; pair('B');
  page.account('user2'); page.render(); assert.ok(page.loading()); assert.equal(page.chat(), null);
});
test('actual page invalidates old collection transcript before new route restore', async () => {
  const pending = deferred();
  const page = await mountPage({
    listCollectionSessions: async id => ({ sessions: [row(id === 'C' ? 'A' : 'B')] }),
    getMessages: id => id === 'A' ? pending.promise : Promise.resolve({ messages: msg(id) }),
  });
  page.route('D'); page.render(); assert.ok(page.loading()); page.commit(); await settle(); page.render(); pair('B');
  pending.resolve({ messages: msg('A') }); await settle(); pair('B');
  assert.equal(page.chat().props.sessionId, 'B');
});
test('retry from disposed or superseded failed intent cannot reopen it', async () => {
  const { controller } = setup({ messages: async id => { if (id === 'A') throw Error('offline'); return { messages: msg(id) }; } });
  await controller.open('A'); await controller.open('B'); await controller.retry(); pair('B');
  await controller.open('A'); controller.dispose(); await controller.retry(); pair('B');
});

test('anonymous collection deep link redirects before loading and keeps its destination', async () => {
  setup(); const page = pageHarness(store, pageApi());
  page.status('unauthenticated');
  assert.equal(page.render(), null); page.commit();
  assert.deepEqual(page.pushes, ['/auth?callbackUrl=%2Fcollections%2FC']);
  assert.equal(page.loading(), null);
});
test('collection Open and New ignore clicks during an active stream in real page callbacks', async () => {
  let messages = 0, creates = 0;
  const page = await mountPage({
    getMessages: async id => { ++messages; return { messages: msg(id) }; },
    createCollectionSession: async () => { ++creates; throw Error('must not run'); },
  });
  store.getState().setStreaming(true); page.render();
  assert.equal(page.sessions().props.disabled, true);
  await page.sessions().props.onSelectSession('A'); await page.sessions().props.onNewSession();
  pair('original'); assert.equal(messages, 1); assert.equal(creates, 0);
  store.getState().setStreaming(false);
});
test('a send started during pending collection Open/New keeps its own session and stream', async () => {
  for (const action of ['open', 'newSession']) {
    const pending = deferred();
    const { controller } = setup({ messages: () => pending.promise, create: () => pending.promise });
    const request = controller[action]('A'); store.getState().setStreaming(true);
    pending.resolve({ messages: msg('A'), session_id: 'new', collection_id: 'C', created_at: 'now' }); await request;
    pair('original'); assert.equal(store.getState().isStreaming, true);
    if (action === 'newSession') assert.equal(store.getState().sessions[0].session_id, 'new');
    store.getState().setStreaming(false);
  }
});
test('collection startup and Open restore mode; a newer choice during pending response wins', async () => {
  const page = await mountPage({ listCollectionSessions: async () => ({ sessions: [
    { ...row('original'), domain_mode: 'academic' }, { ...row('A'), domain_mode: 'legal' }, { ...row('B'), domain_mode: null },
  ] }) });
  assert.equal(store.getState().domainMode, 'academic');
  await page.sessions().props.onSelectSession('A'); assert.equal(store.getState().domainMode, 'legal');
  await page.sessions().props.onSelectSession('B'); assert.equal(store.getState().domainMode, null);
  for (const choice of ['academic', null]) {
    const pending = deferred(); const { controller } = setup({ messages: () => pending.promise });
    store.getState().setSessions([{ ...row('A'), domain_mode: 'legal' }]);
    const opening = controller.open('A'); store.getState().setDomainMode(choice);
    pending.resolve({ messages: msg('A') }); await opening;
    assert.equal(store.getState().domainMode, choice);
  }
});
test('collection new chat starts at Default and keeps newer explicit user input', async () => {
  for (const choice of [undefined, 'legal', null]) {
    const pending = deferred(); const { controller } = setup({ create: () => pending.promise });
    store.getState().setDomainMode('academic'); const creating = controller.newSession();
    if (choice !== undefined) store.getState().setDomainMode(choice);
    pending.resolve({ session_id: 'fresh', collection_id: 'C', title: null, created_at: 'now' }); await creating;
    assert.equal(store.getState().domainMode, choice === undefined ? null : choice);
  }
});
