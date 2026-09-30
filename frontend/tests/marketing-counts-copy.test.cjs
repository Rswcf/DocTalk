const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Counts that marketing copy states about DocTalk. The zh/de/fr/pt ChatPDF and Humata alternatives pages
// kept advertising three AI modes after Thorough was retired (pt still listed Quick, Balanced and Thorough),
// the pt Humata and NotebookLM alternatives pages titled themselves "7 best" while listing five and six, and
// eight home pages kept "Join thousands of professionals" for seven months after English dropped it.

const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/i18n/locales/${l}.json`), 'utf8'))]),
);

const DIGIT_BLOCKS = [0x0660, 0x06f0, 0x0966, 0xff10]; // Arabic-Indic, Extended Arabic-Indic, Devanagari, full-width
const asciiDigits = (s) =>
  DIGIT_BLOCKS.reduce(
    (out, zero) => out.replace(new RegExp(`[\\u${zero.toString(16).padStart(4, '0')}-\\u${(zero + 9).toString(16).padStart(4, '0')}]`, 'g'), (d) => String(d.charCodeAt(0) - zero)),
    s,
  );
const numbersIn = (s) => (asciiDigits(s).match(/\d+(?:[.,]\d+)*/g) || []).filter((n) => !/^(19|20)\d\d$/.test(n));

// The count has to sit next to the locale's word for "mode", so a stray "two" elsewhere in a paragraph does
// not count. Arabic says "two modes" with the dual (وضعان / وضعين / وضعا / وضعي) and no numeral.
const AR = '\\u0621-\\u064A';
const modeCount = (n) => ({
  en: new RegExp(`\\b(${n.en}|${n.digit})\\b(?:[\\s-]+[A-Za-z0-9]+){0,3}?[\\s-]+modes?\\b`, 'i'),
  zh: new RegExp(`(${n.zh}|${n.digit})\\s*(种|个)[^，。；：、]{0,16}?模式`),
  ja: new RegExp(`(${n.ja}|${n.digit})\\s*(つの)?[^、。]{0,24}?モード`),
  ko: new RegExp(`(${n.ko}|${n.digit})\\s?(가지|개)[^.,]{0,16}?모드|(${n.ko}|${n.digit})\\s?모드`),
  es: new RegExp(`\\b(${n.es}|${n.digit})\\s+modos\\b`, 'i'),
  de: new RegExp(`\\b(${n.de}|${n.digit})\\s+(?:[\\w-]+\\s+){0,2}?[\\w-]*(modi|modus)\\b`, 'i'),
  fr: new RegExp(`\\b(${n.fr}|${n.digit})\\s+modes\\b`, 'i'),
  pt: new RegExp(`\\b(${n.pt}|${n.digit})\\s+(?:\\w+\\s+)?modos\\b`, 'i'),
  it: new RegExp(`\\b(${n.it}|${n.digit})\\s+modalit`, 'i'),
  ar: new RegExp(`(?<![${AR}])(?:[وبل])?(?:ال)?(${n.ar})(?![${AR}])|(?<![\\d.,])${n.digit}\\s+(أوضاع|أنماط)`),
  hi: new RegExp(`(?<![\\p{L}\\p{M}\\d])(${n.hi}|${n.digit})(?![\\p{L}\\p{M}\\d])\\s+(?:\\S+\\s+){0,3}?मोड`, 'u'),
});
const TWO_MODES = modeCount({
  digit: '2', en: 'two', zh: '两', ja: '二', ko: '두', es: 'dos', de: 'zwei', fr: 'deux', pt: 'dois|duas', it: 'due',
  hi: 'दो', ar: 'وضعان|وضعين|وضعا|وضعي',
});
const THREE_MODES = modeCount({
  digit: '3', en: 'three', zh: '三', ja: '三', ko: '세', es: 'tres', de: 'drei', fr: 'trois', pt: 'três|three', it: 'tre',
  hi: 'तीन', ar: 'ثلاثة أوضاع|ثلاث[ةه]? أنماط',
});
const modeCountKeys = Object.keys(messages.en).filter((key) => TWO_MODES.en.test(messages.en[key]));

test('the English strings that count the answer modes were found', () => {
  assert.ok(modeCountKeys.includes('altsChatpdf.adv4'));
  assert.ok(modeCountKeys.length >= 25, `only ${modeCountKeys.length} keys found`);
});

test('every locale says two answer modes wherever English does', () => {
  const wrong = [];
  for (const key of modeCountKeys) {
    for (const locale of LOCALES) {
      const value = messages[locale][key] ?? '';
      if (!TWO_MODES[locale].test(asciiDigits(value))) wrong.push(`${locale}: ${key} — "${value.slice(0, 90)}"`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('no string in any locale says DocTalk has three answer modes', () => {
  const wrong = [];
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(messages[locale])) {
      if (THREE_MODES[locale].test(asciiDigits(value))) wrong.push(`${locale}: ${key} — "${value.slice(0, 90)}"`);
    }
  }
  assert.deepEqual(wrong, []);
});

const alternativesDir = path.resolve(__dirname, '../src/app/alternatives');
const withoutComments = (source) =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const alternativesPages = fs
  .readdirSync(alternativesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = path.join(alternativesDir, entry.name);
    const content = fs.readdirSync(dir).find((file) => file.endsWith('AltsContent.tsx'));
    const sections = content ? [...withoutComments(fs.readFileSync(path.join(dir, content), 'utf8')).matchAll(/t\('(\w+)\.alt(\d+)Title'\)/g)] : [];
    const englishTitles = [...fs.readFileSync(path.join(dir, 'page.tsx'), 'utf8').matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
    return { page: entry.name, ns: sections[0]?.[1], listed: new Set(sections.map((m) => m[2])).size, englishTitles };
  });

test('every alternatives page was found with the sections it renders', () => {
  assert.equal(alternativesPages.length, 5);
  for (const { page, ns, listed, englishTitles } of alternativesPages) {
    assert.ok(ns, `${page}: no t('<ns>.alt<N>Title') sections found`);
    assert.ok(listed >= 5, `${page} lists ${listed}`);
    assert.ok(englishTitles.length >= 2, `${page}: English page.tsx titles not found`);
  }
});

test('every alternatives page title states the number of alternatives the page lists, and no other count', () => {
  const wrong = [];
  for (const { page, ns, listed, englishTitles } of alternativesPages) {
    // English search titles are hardcoded in page.tsx and may leave the count out; a count they state must be right.
    for (const title of englishTitles) {
      if (numbersIn(title).some((n) => n !== String(listed))) wrong.push(`en: ${page}/page.tsx says "${title}", page lists ${listed}`);
    }
    for (const key of [`${ns}.heroTitle`, `${ns}.metaTitle`]) {
      for (const locale of LOCALES) {
        const numbers = numbersIn(messages[locale][key] ?? '');
        if (!numbers.includes(String(listed)) || numbers.some((n) => n !== String(listed))) {
          wrong.push(`${locale}: ${key} says "${messages[locale][key]}", page lists ${listed}`);
        }
      }
    }
  }
  assert.deepEqual(wrong, []);
});

// DocTalk has no user base in the thousands to cite. If that changes, point this at the evidence first.
const USER_COUNT_CLAIMS = {
  en: /\b(thousands|hundreds|millions) of (users|professionals|researchers|students|teams|customers|people)\b|\bjoin (thousands|hundreds|millions)\b/i,
  zh: /(数千|数万|成千上万|上千|数百|上百)(名|位|个)?(专业人士|用户|研究人员|学生|团队|客户)/,
  ja: /数(千|万|百)(人|名)/,
  ko: /수(천|만|백)\s?명/,
  es: /\b(miles|cientos|millones) de (usuarios|profesionales|investigadores|estudiantes|equipos|clientes|personas)\b/i,
  de: /\b(Tausende|Hunderte|Millionen) (von )?(Nutzern?|Fachleuten?|Profis|Forschern?|Studierenden|Teams|Kunden|Menschen)\b/i,
  fr: /\b(milliers|centaines|millions) de (utilisateurs|professionnels|chercheurs|étudiants|équipes|clients|personnes)\b/i,
  pt: /\b(milhares|centenas|milhões) de (usuários|profissionais|pesquisadores|estudantes|equipes|clientes|pessoas)\b/i,
  it: /\b(migliaia|centinaia|milioni) di (utenti|professionisti|ricercatori|studenti|team|clienti|persone)\b/i,
  ar: /(آلاف|مئات|ملايين) (من )?(المستخدمين|المحترفين|الباحثين|الطلاب|الفرق|العملاء)/,
  hi: /(हज़ारों|हजारों|सैकड़ों|लाखों) (उपयोगकर्ताओं|पेशेवरों|शोधकर्ताओं|छात्रों)/,
};

test('no locale claims a user base DocTalk does not have', () => {
  const wrong = [];
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(messages[locale])) {
      if (USER_COUNT_CLAIMS[locale].test(value)) wrong.push(`${locale}: ${key} — "${value.slice(0, 90)}"`);
    }
  }
  assert.deepEqual(wrong, []);
});
