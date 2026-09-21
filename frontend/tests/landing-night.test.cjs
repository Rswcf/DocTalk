const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// Night landing (plan .collab/plans/2026-09-21-landing-night.md). The landing
// root is `.dt-editorial.dt-night`: the editorial dark theme in BOTH OS themes.
// It must stay the SAME value set as `.dark .dt-editorial`, never a second one,
// and chrome rendered outside the root must follow it.

const src = path.resolve(__dirname, '../src');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');
const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('every .dark .dt-editorial selector has a .dt-editorial.dt-night twin in the same list', () => {
  const css = stripCssComments(read('app/editorial.css'));
  const preludes = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1]);
  let darkSelectors = 0;
  for (const prelude of preludes) {
    const list = prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    for (const selector of list) {
      if (!/\.dark\b/.test(selector)) continue;
      // Any other spelling (html.dark …, .dark :is(…), .dark > …) would slip
      // past the twin rule; the editorial layer only ever writes this one.
      assert.ok(selector.startsWith('.dark .dt-editorial'), `"${selector}": write dark editorial rules as ".dark .dt-editorial …"`);
      darkSelectors += 1;
      const twin = selector.replace('.dark .dt-editorial', '.dt-editorial.dt-night');
      assert.ok(list.includes(twin), `"${selector}" has no "${twin}" twin in the same selector list`);
    }
  }
  assert.ok(darkSelectors >= 2, 'expected the dark token set and the dark grain at least');
});

test('the app stylesheet never styles the editorial layer through .dark', () => {
  // A .dark rule for editorial classes in globals.css would reach dark-OS
  // marketing pages but never Night in a light OS, silently splitting them.
  const css = stripCssComments(read('app/globals.css'));
  const offenders = [...css.matchAll(/([^{}]+)\{/g)]
    .flatMap((m) => m[1].split(','))
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => /\.dark\b/.test(s) && /\.(dt-editorial|ed-[\w-]+)\b/.test(s));
  assert.deepEqual(offenders, []);
});

// Night-only rules are an explicit, closed list. The owner asked for
// prototype B's deeper ground and its sans headline (2026-09-21), so the
// landing carries exactly two things the dark theme does not: its stage and
// chrome values, and its display type. Anything else under .dt-night must be
// a twin of a .dark .dt-editorial rule.
const NIGHT_STAGE_TOKENS = ['--ed-paper', '--ed-paper-2', '--ed-glass', '--ed-glass-strong', '--ed-display-family'];
const NIGHT_TYPE_SELECTORS = [
  '.dt-editorial.dt-night .ed-display',
  '.dt-editorial.dt-night .ed-h1',
  '.dt-editorial.dt-night .ed-h2',
  '.dt-editorial.dt-night .ed-night-claim .ed-display',
  '.dt-editorial.dt-night .ed-num',
];

test('night-only rules are limited to the stage tokens and the display type', () => {
  const css = stripCssComments(read('app/editorial.css'));
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    list: m[1].trim().replace(/\s+/g, ' ').split(',').map((sel) => sel.trim()),
    body: m[2],
  }));
  let stageBlocks = 0;
  for (const { list, body } of rules) {
    for (const selector of list.filter((sel) => sel.startsWith('.dt-editorial.dt-night'))) {
      const dark = selector.replace('.dt-editorial.dt-night', '.dark .dt-editorial');
      if (list.includes(dark)) continue; // a twin: fine
      const props = [...body.matchAll(/(--?[\w-]+)\s*:/g)].map((m) => m[1]);
      if (selector === '.dt-editorial.dt-night') {
        stageBlocks += 1;
        for (const prop of props) {
          assert.ok(NIGHT_STAGE_TOKENS.includes(prop), `the night stage block may not set ${prop}`);
        }
        continue;
      }
      assert.ok(NIGHT_TYPE_SELECTORS.includes(selector), `"${selector}" is night-only without being on the list`);
      assert.ok(!props.some((prop) => prop.startsWith('--ed-')), `"${selector}" redefines a token`);
    }
  }
  assert.equal(stageBlocks, 1, 'expected exactly one night stage block');
});

test('Geist is loaded by the night module only', () => {
  // Loading it in the root layout would make every route, the app included,
  // preload the face. night.ts is imported by the two marketing roots only.
  const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
    }
    return out;
  };
  const users = walk(src)
    .filter((f) => /from ['"]geist\//.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(src, f));
  assert.deepEqual(users, [path.join('components', 'marketing', 'night.ts')]);
});

test('every marketing root is Night', () => {
  // The landing and MarketingShell are the only two elements that open the
  // editorial system (the cookie banner and the language menu mirror it).
  assert.match(read('components/marketing/night.ts'), /NIGHT_ROOT_CLASS = `dt-editorial dt-night /);
  assert.match(read('components/landing/LandingPageContent.tsx'), /className=\{NIGHT_ROOT_CLASS\}/);
  assert.match(read('components/marketing/MarketingShell.tsx'), /className=\{`\$\{NIGHT_ROOT_CLASS\} /);
  for (const root of ['components/landing/LandingPageContent.tsx', 'components/marketing/MarketingShell.tsx']) {
    assert.match(read(root), /useNightDocument\(\)/, `${root} does not dress the document for Night`);
  }
});

test('display type goes through --ed-display-family, never straight to Fraunces', () => {
  // One token swaps the display voice for Night; a direct var(--dt-serif)
  // would stay Fraunces on a Geist page.
  const css = stripCssComments(read('app/editorial.css'));
  const direct = [...css.matchAll(/([^{}]+)\{[^{}]*font-family:\s*var\(--dt-serif\)/g)].map((m) => m[1].trim());
  assert.deepEqual(direct, [], `font-family: var(--dt-serif) outside the token: ${direct.join(' | ')}`);
  for (const file of [
    'components/marketing/EditorialHeaderBase.tsx',
    'components/landing/EditorialFooter.tsx',
    'app/demo/DemoPageClient.tsx',
    'app/tools/reading-time/ReadingTimeClient.tsx',
  ]) {
    assert.doesNotMatch(read(file), /var\(--dt-serif\)/, `${file} sets Fraunces directly`);
  }
});

test('chrome rendered outside the landing root mirrors Night', () => {
  // Both render outside the page root (the banner is a sibling of
  // #page-content; the language menu is portalled to <body>), so neither can
  // inherit the class and each must look for it.
  assert.match(read('components/CookieConsentBanner.tsx'), /dt-night/);
  assert.match(read('components/marketing/EdLanguageSelector.tsx'), /closest\(["']\.dt-night["']\)/);
});

// ── The citation field (slice 2) ─────────────────────────────────────────

const repoRoot = path.resolve(__dirname, '../..');
const stringLiterals = (code) =>
  [...code.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));

function fieldContent() {
  const code = read('components/landing/citationFieldContent.ts');
  const paraBlock = code.slice(code.indexOf('export const PARAGRAPHS'), code.indexOf('];', code.indexOf('export const PARAGRAPHS')));
  const citedBlock = code.slice(code.indexOf('export const CITED'));
  return { paragraphs: stringLiterals(paraBlock), cited: stringLiterals(citedBlock)[0] };
}

test('the hero document is verbatim page 1 of the finance seed PDF, and CITED is inside it', (t) => {
  const { paragraphs, cited } = fieldContent();
  assert.ok(paragraphs.length >= 10, `expected the page's paragraphs, got ${paragraphs.length}`);
  assert.ok(cited && cited.length > 40, 'CITED is missing');
  assert.equal(paragraphs.filter((p) => p.includes(cited)).length, 1, 'CITED must be one sentence inside exactly one paragraph');

  const { spawnSync } = require('node:child_process');
  const pdf = path.join(repoRoot, 'backend/seed_data/alphabet-earnings.pdf');
  const out = spawnSync('pdftotext', ['-f', '1', '-l', '1', pdf, '-'], { encoding: 'utf8' });
  if (out.error || out.status !== 0) {
    // CI installs poppler, so a missing pdftotext there is a broken job, not a
    // reason to skip the one check that the hero quotes its source exactly.
    assert.ok(!process.env.CI, 'pdftotext is missing in CI; install poppler-utils');
    t.skip('pdftotext is not installed; the verbatim check needs it (brew install poppler)');
    return;
  }
  const normalise = (s) => s.replace(/\s+/g, ' ').trim();
  const page = normalise(out.stdout);
  for (const p of paragraphs) {
    assert.ok(page.includes(normalise(p)), `not verbatim on page 1: "${p.slice(0, 70)}…"`);
  }
});

test('the citation field takes every colour and font from the tokens', () => {
  const code = read('components/landing/CitationField.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /['"`]#[0-9a-f]{3,8}\b/i, 'hardcoded hex colour in CitationField');
  assert.doesNotMatch(code, /IBM Plex Sans|Geist|system-ui/, 'hardcoded font family in CitationField');
  for (const token of ['--ed-ink', '--ed-evidence', '--ed-evidence-soft']) {
    assert.ok(code.includes(`'${token}'`), `CitationField no longer reads ${token}`);
  }
});

test('the hero no longer carries the v0.31.0 product frame', () => {
  assert.equal(fs.existsSync(path.join(src, 'components/landing/ProductFrame.tsx')), false);
  const hero = read('components/landing/HeroSection.tsx');
  assert.doesNotMatch(hero, /ProductFrame/);
  assert.match(hero, /<CitationField\b/);
});

test('the answer card copy exists in all 11 locales', () => {
  // The card is real text in every locale; only the document behind it stays
  // English. The four frame keys change together whenever the sample changes
  // (see citationFieldContent.ts).
  const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
  const keys = ['landing.frame.question', 'landing.frame.answer', 'landing.frame.source', 'landing.frame.description', 'landing.frame.quoteFinder'];
  for (const locale of LOCALES) {
    const messages = JSON.parse(read(`i18n/locales/${locale}.json`));
    for (const key of keys) {
      assert.ok(typeof messages[key] === 'string' && messages[key].trim(), `${key} missing or empty in ${locale}.json`);
    }
  }
});

test('both field settings place the citation inside the laid-out repeats', () => {
  // With occurrence >= repeat the sentence is never laid out: no highlight,
  // and (before the guard in CitationField) a loop with nothing to animate.
  const hero = read('components/landing/HeroSection.tsx');
  const block = (name) => hero.slice(hero.indexOf(`const ${name}: CitationFieldSettings = {`), hero.indexOf('};', hero.indexOf(`const ${name}: CitationFieldSettings = {`)));
  const num = (text, key) => { const m = text.match(new RegExp(`\\b${key}: (\\d+)`)); return m ? Number(m[1]) : undefined; };
  const wide = block('WIDE');
  const narrow = block('NARROW');
  for (const [name, text] of [['WIDE', wide], ['NARROW', narrow]]) {
    const repeat = num(text, 'repeat') ?? num(wide, 'repeat');
    const occurrence = num(text, 'occurrence') ?? num(wide, 'occurrence');
    assert.ok(Number.isInteger(repeat) && Number.isInteger(occurrence), `${name}: repeat/occurrence not found`);
    assert.ok(occurrence < repeat, `${name}: occurrence ${occurrence} must be < repeat ${repeat}`);
  }
});
