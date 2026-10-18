const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

class ApiError extends Error { constructor(status) { super('API error'); this.status = status; } }
function load(relative, mocks) {
  const filename = path.resolve(__dirname, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, fileName: filename }).outputText;
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod); mod.require = name => name in mocks ? mocks[name] : original(name);
  mod._compile(compiled, filename); return mod.exports;
}
const lib = load('../src/lib/refunds.ts', { './api': { ApiError, PROXY_BASE: '/api/proxy' } });
const eligible = { id: 'operation_one', invoice_id: 'in_one', status: 'eligible', confirmation_required: true, amount_minor: 1299, currency: 'usd', credits_to_revoke: 3000, consequences: { ends_subscription_immediately: true, revokes_credits: 3000 } };
const checked = { confirm_full_refund: true, confirm_immediate_cancellation: true, confirm_credit_revocation: true };
function response(status, body) { return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }; }

test('options hide disabled and pre-feature404; other errors are not treated as permission to show', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push([url, init]); return response(200, { enabled: false, options: [] }); };
  assert.equal(await lib.getRefundOptions(), null);
  assert.equal(calls[0][0], '/api/proxy/api/billing/refund-options');
  assert.equal(calls[0][1].method, 'GET'); assert.equal(calls[0][1].cache, 'no-store');
  global.fetch = async () => response(404, {}); assert.equal(await lib.getRefundOptions(), null);
  global.fetch = async () => response(503, {}); await assert.rejects(lib.getRefundOptions, error => error.status === 503);
});

test('all three confirmations and current eligible state are required before any POST', async () => {
  let requests = 0; global.fetch = async () => { requests++; return response(200, { ...eligible, status: 'completed' }); };
  for (const key of Object.keys(checked)) await assert.rejects(() => lib.confirmRefundRequest(eligible, { ...checked, [key]: false }));
  for (const status of ['review', 'reserved', 'cash_pending', 'cash_unknown', 'cash_succeeded', 'cash_reversed', 'repair_required', 'completed', 'future_status']) await assert.rejects(() => lib.confirmRefundRequest({ ...eligible, status }, checked));
  await assert.rejects(() => lib.confirmRefundRequest({ ...eligible, confirmation_required: false }, checked));
  assert.equal(requests, 0);
  await lib.confirmRefundRequest(eligible, checked); assert.equal(requests, 1);
});

test('create is separate from confirm, review request kind is preserved, GET only reads the operation', async () => {
  const calls = []; global.fetch = async (url, init) => { calls.push([url, init]); return response(200, eligible); };
  await lib.createRefundRequest('in_server', 'statutory', '  Please review  ');
  await lib.getRefundRequest('owned/id');
  await lib.confirmRefundRequest(eligible, checked);
  assert.deepEqual(JSON.parse(calls[0][1].body), { invoice_id: 'in_server', request_kind: 'statutory', reason: 'Please review' });
  assert.equal(calls[0][0], '/api/proxy/api/billing/refund-requests');
  assert.equal(calls[1][0], '/api/proxy/api/billing/refund-requests/owned%2Fid'); assert.equal(calls[1][1].method, 'GET'); assert.equal(calls[1][1].body, undefined);
  assert.equal(calls[2][0], '/api/proxy/api/billing/refund-requests/operation_one/confirm'); assert.deepEqual(JSON.parse(calls[2][1].body), checked);
});

test('display uses backend minor amount, currency precision and selected locale', () => {
  assert.equal(lib.formatRefundAmount(1299, 'usd', 'en'), '$12.99');
  assert.equal(lib.formatRefundAmount(1500, 'jpy', 'en'), '¥1,500');
  assert.match(lib.formatRefundAmount(1299, 'usd', 'de'), /12,99/);
});

function renderer(overrides = {}, actions = {}) {
  const states = []; let cursor = 0; const completions = [];
  const options = { enabled: true, options: [{ invoice_id: 'in_server', amount_minor: 1299, currency: 'usd', paid_at: '2026-10-18T12:00:00Z' }] };
  states[0] = options; states[1] = 'in_server'; states[9] = []; states[10] = true; Object.assign(states, overrides);
  const component = load('../src/components/RefundPanel.tsx', {
    react: { useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useRef: value => ({ current: value }), useEffect: () => {}, useCallback: callback => callback },
    '../i18n': { useLocale: () => ({ tOr: (key, fallback) => fallback, locale: 'en' }) },
    '../lib/refunds': { ...lib, ...actions },
  }).default;
  return { states, completions, render() { cursor = 0; return component({ onCompleted: () => completions.push(true), onAvailabilityChange: () => {} }); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  const children = tree.props?.children;
  return [tree, ...[children].flat(Infinity).flatMap(nodes)];
}
function text(tree) { if (Array.isArray(tree)) return tree.map(text).join(''); return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? ''); }
function button(tree, label) { return nodes(tree).find(node => node.type === 'button' && text(node) === label); }
const tick = () => new Promise(resolve => setImmediate(resolve));

test('panel hides without enabled options; unknown outcomes have review wording and no confirm', () => {
  assert.equal(renderer({ 0: null }).render(), null);
  assert.equal(renderer({ 0: { enabled: false } }).render(), null);
  for (const status of ['cash_reversed', 'future_status']) {
    const tree = renderer({ 4: { ...eligible, status } }).render();
    assert.match(text(tree), /needs verification/);
    assert.equal(button(tree, 'Review refund'), undefined);
    assert.equal(button(tree, 'Confirm refund and end subscription')?.props.disabled, true);
  }
});

test('eligible preview requires three separate unchecked choices; duplicate clicks send one confirm', async () => {
  let creates = 0, confirms = 0;
  const instance = renderer({}, { createRefundRequest: async () => { creates++; return eligible; }, confirmRefundRequest: async (operation, checks) => { assert.equal(lib.canConfirmRefund(operation, checks), true); confirms++; return { ...operation, status: 'completed', confirmation_required: false }; } });
  let tree = instance.render(); nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await tick();
  tree = instance.render(); assert.equal(creates, 1); assert.match(text(tree), /\$12\.99/); assert.match(text(tree), /3,000/);
  assert.equal(button(tree, 'Confirm refund and end subscription').props.disabled, true);
  const inputs = nodes(tree).filter(node => node.type === 'input' && node.props.type === 'checkbox'); assert.equal(inputs.length, 3);
  for (const input of inputs) { assert.equal(input.props.checked, false); input.props.onChange({ target: { checked: true } }); }
  tree = instance.render(); const confirm = button(tree, 'Confirm refund and end subscription'); assert.equal(confirm.props.disabled, false);
  confirm.props.onClick(); confirm.props.onClick(); await tick(); assert.equal(confirms, 1); assert.equal(instance.completions.length, 1);
});

test('cash success and repair statuses do not refresh profile or claim complete; owner GET does', async () => {
  const instance = renderer({ 4: { ...eligible, status: 'cash_succeeded' } }, { getRefundRequest: async () => ({ ...eligible, status: 'completed', confirmation_required: false }) });
  const tree = instance.render(); assert.match(text(tree), /still being completed/); assert.equal(instance.completions.length, 0);
  button(tree, 'Refresh status').props.onClick(); await tick(); assert.equal(instance.completions.length, 1);
});

test('all11 locale files contain every refund key, and paid application policy is gated', () => {
  const dir = path.resolve(__dirname, '../src/i18n/locales');
  const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')); const keys = Object.keys(en).filter(key => key.startsWith('billing.refund.'));
  assert.equal(keys.length, 31);
  for (const locale of ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi']) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, locale + '.json'), 'utf8'));
    for (const key of keys) { assert.equal(typeof data[key], 'string', `${locale}:${key}`); assert.ok(data[key].trim()); }
  }
  const billing = fs.readFileSync(path.resolve(__dirname, '../src/app/billing/BillingPageClient.tsx'), 'utf8');
  assert.match(billing, /refundPolicyEnabled \? tOr\('billing.refund.policy'/);
  assert.match(billing, /onAvailabilityChange=\{setRefundPolicyEnabled\}/);
});


test('disabled sales preserve owner request history and offer only read status, with no new request form', () => {
  const operation = { ...eligible, status: 'cash_unknown' };
  const tree = renderer({ 0: null, 4: operation, 9: [operation] }).render();
  assert.match(text(tree), /needs verification/);
  assert.ok(button(tree, 'Refresh status'));
  assert.equal(nodes(tree).filter(node => node.type === 'form').length, 0);
  assert.equal(button(tree, 'Create refund request'), undefined);
});

test('DB-only history route restores owned operations without submitting anything', async () => {
  const calls = []; global.fetch = async (url, init) => { calls.push([url, init]); return response(200, { operations: [eligible] }); };
  assert.deepEqual(await lib.getRefundRequests(), [eligible]);
  assert.equal(calls[0][0], '/api/proxy/api/billing/refund-requests');
  assert.equal(calls[0][1].method, 'GET'); assert.equal(calls[0][1].body, undefined);
  global.fetch = async () => response(404, {}); assert.deepEqual(await lib.getRefundRequests(), []);
});
