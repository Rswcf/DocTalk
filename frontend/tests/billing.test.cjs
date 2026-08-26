const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function loadBillingModule({ createSubscription, trackEvent, billingHref = () => '/billing' }) {
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
    if (request === './billingLinks') return { billingHref };
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

for (const plan of ['plus', 'pro']) {
  test(`plan-aware billing starts Checkout for Free→${plan[0].toUpperCase()}${plan.slice(1)}`, async () => {
    const calls = [];
    global.window = { location: { href: '' } };
    const { startPlanAwareBillingAction } = loadBillingModule({
      createSubscription: async (params) => {
        calls.push(params);
        return { checkout_url: `https://checkout.test/${plan}` };
      },
      trackEvent: () => {},
    });

    await startPlanAwareBillingAction({
      currentPlan: 'free',
      plan,
      billing: 'monthly',
      source: 'test',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].plan, plan);
    assert.equal(global.window.location.href, `https://checkout.test/${plan}`);
  });
}

test('plan-aware billing routes Plus→Pro through the billing change-plan flow', async () => {
  const calls = [];
  global.window = { location: { href: '' } };
  const { startPlanAwareBillingAction } = loadBillingModule({
    createSubscription: async () => {
      calls.push('createSubscription');
      return { checkout_url: 'https://checkout.test/unexpected' };
    },
    trackEvent: (name) => calls.push(name),
    billingHref: ({ plan, period, source, reason }) => `/billing?plan=${plan}&period=${period}&source=${source}&reason=${reason}`,
  });

  await startPlanAwareBillingAction({
    currentPlan: 'plus',
    plan: 'pro',
    billing: 'monthly',
    source: 'upload_error',
    reason: 'file_size',
  });

  assert.deepEqual(calls, ['upgrade_click']);
  assert.equal(global.window.location.href, '/billing?plan=pro&period=monthly&source=upload_error&reason=file_size');
});

test('plan-aware billing sends Pro insufficient-credit actions to credit packs', async () => {
  let checkoutCalls = 0;
  global.window = { location: { href: '' } };
  const { startPlanAwareBillingAction } = loadBillingModule({
    createSubscription: async () => {
      checkoutCalls += 1;
      return { checkout_url: 'https://checkout.test/unexpected' };
    },
    trackEvent: () => {},
    billingHref: ({ plan, period, source, reason }) => `/billing?plan=${plan}&period=${period}&source=${source}&reason=${reason}`,
  });

  await startPlanAwareBillingAction({
    currentPlan: 'pro',
    plan: 'pro',
    billing: 'monthly',
    source: 'paywall_modal',
    reason: 'credits',
  });

  assert.equal(checkoutCalls, 0);
  assert.equal(global.window.location.href, '/billing?plan=pro&period=monthly&source=paywall_modal&reason=credits#credit-packs');
});
