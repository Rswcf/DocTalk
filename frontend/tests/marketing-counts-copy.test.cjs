const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Counts that marketing copy states about DocTalk. The zh/de/fr/pt ChatPDF and Humata alternatives pages
// kept advertising three AI modes after Thorough was retired (pt still listed Quick, Balanced and Thorough),
// and the pt Humata and NotebookLM alternatives pages titled themselves "7 best" while listing five and six.

const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/i18n/locales/${l}.json`), 'utf8'))]),
);

const asciiDigits = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
const statesNumber = (s, n) => new RegExp(`(?<![\\d,.])${n}(?![\\d,.])`).test(asciiDigits(s));

// Flash and Pro. Arabic counts two modes with the dual (وضعان / وضعين / وضعا / وضعي).
const TWO = {
  en: /\btwo\b/i,
  zh: /两/,
  ja: /二つ/,
  ko: /두/,
  es: /\bdos\b/i,
  de: /\bzwei\b/i,
  fr: /\bdeux\b/i,
  pt: /\b(dois|duas)\b/i,
  it: /\bdue\b/i,
  ar: /وضعان|وضعين|وضعا|وضعي|اثنان|اثنين/,
  hi: /दो/,
};
const modeCountKeys = Object.keys(messages.en).filter((key) =>
  /\b(two|2)\b(?:[\s-]+[A-Za-z0-9]+){0,3}?[\s-]+modes?\b/i.test(messages.en[key]),
);

test('the English strings that count the answer modes were found', () => {
  assert.ok(modeCountKeys.includes('altsChatpdf.adv4'));
  assert.ok(modeCountKeys.length >= 25, `only ${modeCountKeys.length} keys found`);
});

test('every locale says two answer modes wherever English does', () => {
  const wrong = [];
  for (const key of modeCountKeys) {
    for (const locale of LOCALES) {
      const value = messages[locale][key] ?? '';
      if (!TWO[locale].test(value) && !statesNumber(value, 2)) wrong.push(`${locale}: ${key} — "${value.slice(0, 90)}"`);
    }
  }
  assert.deepEqual(wrong, []);
});

const alternativesDir = path.resolve(__dirname, '../src/app/alternatives');
const alternativesPages = fs
  .readdirSync(alternativesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = path.join(alternativesDir, entry.name);
    const content = fs.readdirSync(dir).find((file) => file.endsWith('AltsContent.tsx'));
    const source = fs.readFileSync(path.join(dir, content), 'utf8');
    const sections = [...source.matchAll(/t\('(\w+)\.alt(\d+)Title'\)/g)];
    return { page: entry.name, ns: sections[0][1], listed: new Set(sections.map((m) => m[2])).size };
  });

test('every alternatives page was found with the sections it renders', () => {
  assert.equal(alternativesPages.length, 5);
  for (const { page, listed } of alternativesPages) assert.ok(listed >= 5, `${page} lists ${listed}`);
});

test('every locale titles an alternatives page with the number of alternatives it lists', () => {
  const wrong = [];
  for (const { ns, listed } of alternativesPages) {
    for (const key of [`${ns}.heroTitle`, `${ns}.metaTitle`]) {
      for (const locale of LOCALES) {
        const value = messages[locale][key] ?? '';
        if (!statesNumber(value, listed)) wrong.push(`${locale}: ${key} does not say ${listed} — "${value}"`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});
