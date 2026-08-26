const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function loadBillingModule({ createSubscription, trackEvent }) {
  const filename = path.resolve(__dirname, '../src/lib/billing.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const billingModule = new Module(filename, module);
  billingModule.filename = filename;
  billingModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = billingModule.require.bind(billingModule);
  billingModule.require = (request) => {
    if (request === './api') return { createSubscription };
    if (request === './analytics') return { trackEvent };
    return realRequire(request);
  };
  billingModule._compile(compiled, filename);
  return billingModule.exports;
}

test('startCheckout records the intent before the request and records checkout failures', async () => {
  const failure = new Error('Stripe is temporarily unavailable');
  const calls = [];
  const { startCheckout } = loadBillingModule({
    createSubscription: async (params) => {
      calls.push(['createSubscription', params]);
      throw failure;
    },
    trackEvent: (name, properties) => calls.push([name, properties]),
  });
  const intent = {
    plan: 'plus',
    billing: 'annual',
    source: 'paywall_modal',
    reason: 'domain_mode',
  };

  await assert.rejects(() => startCheckout(intent), (error) => error === failure);
  assert.deepEqual(calls, [
    ['upgrade_click', {
      plan: 'plus',
      period: 'annual',
      source: 'paywall_modal',
      reason: 'domain_mode',
    }],
    ['createSubscription', intent],
    ['checkout_failed', {
      plan: 'plus',
      period: 'annual',
      source: 'paywall_modal',
      reason: 'domain_mode',
    }],
  ]);
});
