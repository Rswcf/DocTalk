const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The free plan's monthly allowance is stated in ~40 marketing strings. Five translated landing FAQs (the answer
// also ships as FAQPage JSON-LD) and three comparison pages promised 500 credits for months while the backend
// granted 300, and three landing FAQs promised "hundreds of questions" where English says "dozens".

const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/i18n/locales/${l}.json`), 'utf8'))]),
);
const config = fs.readFileSync(path.resolve(__dirname, '../../backend/app/core/config.py'), 'utf8');
const FREE = config.match(/PLAN_FREE_MONTHLY_CREDITS:\s*int\s*=\s*(\d+)/)[1];

const asciiDigits = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
const statesFree = (s) => new RegExp(`(?<![\\d,.])${FREE}(?![\\d,.])`).test(asciiDigits(s));
const allowanceKeys = Object.keys(messages.en).filter((key) =>
  new RegExp(`(?<![\\d,.])${FREE}(?![\\d,.])[^.]*credit`, 'i').test(messages.en[key]),
);

test('the English strings that state the free allowance were found', () => {
  assert.ok(allowanceKeys.includes('landing.faq.a5'));
  assert.ok(allowanceKeys.length >= 30, `only ${allowanceKeys.length} keys found`);
});

test('every locale states the backend free allowance wherever English does', () => {
  for (const key of allowanceKeys) {
    for (const locale of LOCALES) {
      const value = messages[locale][key];
      assert.ok(value, `${locale}: ${key} is missing`);
      assert.ok(statesFree(value), `${locale}: ${key} does not say ${FREE} — "${value.slice(0, 90)}"`);
    }
  }
});

test('no locale promises hundreds of questions on the free allowance', () => {
  const hundreds = /hundreds|数百|上百|수백|cientos|centaines|Hunderte|centenas|centinaia|सैकड़ों|مئات/i;
  for (const key of allowanceKeys) {
    for (const locale of LOCALES) assert.doesNotMatch(messages[locale][key], hundreds, `${locale}: ${key}`);
  }
});

test('month one is described as the starter pool first, never as starter credits plus the monthly grant', () => {
  // Signup grants the 500 starter credits and stamps the monthly clock, so the first 300 arrives in month two
  // (auth_service.py, credit_service.ensure_monthly_credits). "500 starter + 300/month" read as 800 in month one.
  for (const key of ['auth.freeCredits', 'pricing.free.feature1']) {
    for (const locale of LOCALES) {
      const value = asciiDigits(messages[locale][key]);
      assert.match(value, /(?<![\d,.])500(?![\d,.])/, `${locale}: ${key} lost the starter credits`);
      assert.ok(statesFree(value), `${locale}: ${key} lost the monthly grant`);
      assert.doesNotMatch(value, /\+/, `${locale}: ${key} adds the starter credits to the monthly grant`);
      assert.ok(value.indexOf('500') < value.indexOf(FREE), `${locale}: ${key} should lead with the starter pool`);
    }
  }
  assert.match(messages.en['pricing.free.feature1'], /second month/);
});
