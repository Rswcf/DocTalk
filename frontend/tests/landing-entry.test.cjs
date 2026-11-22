// Landing entry row (M1) and masthead action (M3), plan
// .collab/plans/2026-11-22-ui-ux-pangram-learnings.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
require('./_load-ts.cjs');
const { DEMO_SAMPLES, DEMO_QUESTION_MAX, demoSampleHref } = require('../src/lib/demoSamples.ts');

const src = (p) => fs.readFileSync(path.join(__dirname, '../src', p), 'utf8');
const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const messages = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(src(`i18n/locales/${l}.json`))]));

test('sample links carry the question through /demo/<route>, encoded and capped', () => {
  const [earnings] = DEMO_SAMPLES;
  assert.equal(demoSampleHref(earnings, ''), '/demo/earnings');
  assert.equal(demoSampleHref(earnings, ' What & why? '), '/demo/earnings?question=What%20%26%20why%3F');
  const long = decodeURIComponent(demoSampleHref(earnings, 'x'.repeat(1000)).split('question=')[1]);
  assert.equal(long.length, DEMO_QUESTION_MAX);
});

test('every sample route resolves in the /demo/<sample> redirect, which forwards ?question=', () => {
  const redirect = src('app/demo/[sample]/DemoRedirectPageClient.tsx');
  for (const sample of DEMO_SAMPLES) {
    assert.match(redirect, new RegExp(`'${sample.route}': '${sample.slug}'`), `${sample.route} is not mapped to ${sample.slug}`);
  }
  assert.match(redirect, /searchParams\.get\('question'\)/);
  assert.match(redirect, /DEMO_QUESTION_MAX/);
});

test('/demo cards and the hero chips ask the same suggested questions', () => {
  const demo = src('app/demo/DemoPageClient.tsx');
  assert.doesNotMatch(demo, /questionKey: 'demo\.sample\./, 'DemoPageClient must read question keys from lib/demoSamples');
  for (const sample of DEMO_SAMPLES) assert.ok(demo.includes(`demoQuestionKey('${sample.slug}')`));
});

test('the hero keeps one filled CTA; the entry row is badge + quiet chips', () => {
  const hero = src('components/landing/HeroSection.tsx');
  assert.equal((hero.match(/className="ed-cta"/g) || []).length, 1);
  assert.match(hero, /className="ed-night-entry"/);
  assert.match(hero, /DEMO_SAMPLES\.map/);
  assert.match(hero, /className="ed-chip"/);
  assert.match(hero, /tOr\('demo\.freeNoSignup'/);
});

test('the localized landing seeds the strings the entry row reads', () => {
  const page = src('app/[locale]/page.tsx');
  const prefixes = page.slice(page.indexOf('LANDING_PREFIXES'), page.indexOf('] as const'));
  for (const key of ['demo.freeNoSignup', 'demo.sample.earnings.question', 'landing.entry.tryLabel', 'header.trySample']) {
    const seeded = [...prefixes.matchAll(/'([^']+)'/g)].some(([, p]) => key.startsWith(p));
    assert.ok(seeded, `${key} is not seeded for localized SSR`);
  }
});

test('the masthead action is quiet, skips /demo, and phones get language and sign-in in the menu', () => {
  const header = src('components/marketing/EditorialHeaderBase.tsx');
  assert.doesNotMatch(header, /className="ed-cta"/, 'the masthead never carries a filled CTA');
  assert.match(header, /!onDemoPage && \(/);
  assert.match(header, /className="ed-cta-quiet"[\s\S]{0,200}labels\.trySample|labels\.trySample[\s\S]{0,10}/);
  const panel = header.slice(header.indexOf('id="ed-mobile-nav"'));
  assert.match(panel, /labels\.signIn/);
  assert.match(panel, /<EdLanguageSelector/);
  assert.match(src('i18n/chrome.ts'), /trySample: tOr\('header\.trySample'/);
});

test('entry-row and masthead strings exist in all 11 locales', () => {
  const keys = ['header.trySample', 'landing.entry.tryLabel', 'landing.entry.sample.earnings', 'landing.entry.sample.paper', 'landing.entry.sample.court', 'demo.freeNoSignup'];
  for (const sample of DEMO_SAMPLES) keys.push(sample.questionKey, sample.chipKey);
  for (const l of LOCALES) for (const k of keys) assert.ok(messages[l][k], `${l}.json is missing ${k}`);
});
