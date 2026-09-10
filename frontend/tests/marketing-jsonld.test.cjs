const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const src = path.resolve(__dirname, '../src');
const cache = new Map();

// Execute real server pages, translations, routing and schema components.
// Leave unrelated presentation boundaries opaque; inspect their actual props.
// The unchanged EdFaqList is also server-rendered below.
function loadSource(relativePath) {
  const filename = path.resolve(src, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, loaded);
  if (filename.includes('/components/marketing/')
    && !/JsonLd\.tsx$/.test(filename) && !filename.endsWith('/EdFaqList.tsx')) {
    const boundary = () => null;
    boundary.displayName = path.basename(filename, '.tsx');
    loaded.exports = { __esModule: true, default: boundary };
    return loaded.exports;
  }
  loaded.require = function requireSource(request) {
    if (request === 'next/navigation') {
      return { notFound: () => { throw new Error('NEXT_NOT_FOUND'); } };
    }
    if (request.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), request);
      for (const extension of ['.ts', '.tsx']) {
        if (fs.existsSync(target + extension)) return loadSource(target + extension);
      }
    }
    return Module.prototype.require.call(this, request);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const { MARKETING_LOCALES } = loadSource('i18n/routing.ts');
const { getServerT } = loadSource('i18n/server.ts');
const MarketingPageJsonLd = loadSource('components/marketing/MarketingPageJsonLd.tsx').default;
const EdFaqList = loadSource('components/marketing/EdFaqList.tsx').default;
const origin = 'https://www.doctalk.site';
const cases = [
  ['compliance', 'Compliance', 5],
  ['consultants', 'Consultants', 5],
  ['finance', 'Finance', 5],
  ['healthcare', 'Healthcare', 5],
  ['hr-contracts', 'HrContracts', 4],
  ['real-estate', 'RealEstate', 5],
  ['students', 'Students', 5],
  ['teachers', 'Teachers', 5],
  ['', 'UseCasesHub', 0],
];

function findElement(node, name) {
  if (Array.isArray(node)) return node.map((child) => findElement(child, name)).find(Boolean);
  if (!React.isValidElement(node)) return undefined;
  if ((node.type.displayName || node.type.name) === name) return node;
  return findElement(node.props.children, name);
}

async function emittedSchemas(node) {
  if (Array.isArray(node)) return (await Promise.all(node.map(emittedSchemas))).flat();
  if (!React.isValidElement(node)) return [];
  if (node.type === 'script' && node.props.type === 'application/ld+json') {
    const html = renderToStaticMarkup(node);
    return [JSON.parse(html.match(/^<script[^>]*>([\s\S]*)<\/script>$/)[1])].flat();
  }
  if (typeof node.type === 'function') {
    // Inspect page content independently, without executing client shells.
    if (node.type.name.endsWith('Content')) return [];
    return emittedSchemas(await node.type(node.props));
  }
  return emittedSchemas(node.props.children);
}

const schemaTypes = (blocks) => blocks.map((block) => block['@type']);
const faqEntries = (block) => block.mainEntity.map((item) => ({
  question: item.name, answer: item.acceptedAnswer.text,
}));

for (const [slug, name, count] of cases) {
  const route = `/use-cases${slug ? `/${slug}` : ''}`;
  test(`${route}: schema matches visible content and local URLs in all 11 languages`, async () => {
    const folder = `app${route}`;
    const Content = loadSource(`${folder}/${name}Content.tsx`).default;
    const EnPage = loadSource(`${folder}/page.tsx`).default;
    const LocalePage = loadSource(`app/[locale]${route}/page.tsx`).default;
    const expectedTypes = count ? ['Article', 'FAQPage', 'BreadcrumbList'] : ['Article', 'BreadcrumbList'];
    const enBlocks = await emittedSchemas(await EnPage());
    assert.deepEqual(schemaTypes(enBlocks), expectedTypes);

    for (const locale of MARKETING_LOCALES) {
      const blocks = locale === 'en' ? enBlocks
        : await emittedSchemas(await LocalePage({ params: { locale } }));
      assert.deepEqual(schemaTypes(blocks), schemaTypes(enBlocks), `${locale}: type parity, no duplicate Article`);
      // inLanguage applies to CreativeWork-descended types only; BreadcrumbList
      // is ItemList -> Intangible -> Thing and must NOT carry it.
      for (const block of blocks) {
        if (block['@type'] === 'BreadcrumbList') {
          assert.ok(!('inLanguage' in block), 'BreadcrumbList must not carry inLanguage');
        } else {
          assert.equal(block.inLanguage, locale);
        }
      }

      const content = await Content({ locale });
      const hero = findElement(content, 'EdPageHero').props;
      const article = blocks.find((block) => block['@type'] === 'Article');
      assert.equal(article.headline, hero.title);
      assert.equal(article.description, hero.lede);
      const localeRoot = locale === 'en' ? '/' : `/${locale}`;
      const pageUrl = `${origin}${locale === 'en' ? '' : `/${locale}`}${route}`;
      assert.equal(article.mainEntityOfPage['@id'], pageUrl);
      assert.equal(article.author.url, `${origin}${localeRoot}`);
      assert.equal(article.publisher.url, `${origin}${localeRoot}`);
      // Assets have no translated routes and must stay unprefixed.
      assert.equal(article.image, `${origin}/opengraph-image`);
      assert.equal(article.publisher.logo, `${origin}/logo-icon.png`);

      const trail = findElement(content, 'MarketingShell').props.breadcrumb;
      const breadcrumbs = blocks.find((block) => block['@type'] === 'BreadcrumbList');
      assert.deepEqual(breadcrumbs.itemListElement, trail.map(({ label, href }, index) => ({
        '@type': 'ListItem', position: index + 1, name: label,
        ...(href ? { item: `${origin}${href}` } : {}),
      })));

      const visibleFaq = findElement(content, 'EdFaqList');
      const faq = blocks.find((block) => block['@type'] === 'FAQPage');
      if (!count) {
        assert.equal(visibleFaq, undefined);
        assert.equal(faq, undefined);
        continue;
      }
      const items = visibleFaq.props.items;
      assert.equal(items.length, slug === 'finance' && locale === 'en' ? 6 : count);
      assert.deepEqual(faqEntries(faq), items, `${locale}: schema must equal the page's t() questions AND answers`);
      assert.equal(renderToStaticMarkup(React.createElement(EdFaqList, { items: faqEntries(faq) })),
        renderToStaticMarkup(visibleFaq));
      assert.doesNotMatch(JSON.stringify(faq), /useCases\w+\.faq/);
    }
  });
}

test('finance footnote question uses the rendered key and preserves the EN-only condition', async () => {
  const FinanceJsonLd = loadSource('app/use-cases/finance/FinanceJsonLd.tsx').default;
  const { t } = await getServerT('en');
  const blocks = await emittedSchemas(await FinanceJsonLd({ locale: 'en' }));
  const questions = faqEntries(blocks.find((block) => block['@type'] === 'FAQPage')).map((item) => item.question);
  assert.ok(questions.includes(t('useCasesFinance.faq.q6.question')));
  assert.ok(questions.includes('Can DocTalk summarize financial statement footnotes from 10-K filings?'));
  assert.ok(!questions.includes('Can AI summarize financial statement footnotes from 10-K filings?'));
  for (const locale of MARKETING_LOCALES.filter((value) => value !== 'en')) {
    const translated = await emittedSchemas(await FinanceJsonLd({ locale }));
    assert.equal(translated.find((block) => block['@type'] === 'FAQPage').mainEntity.length, 5);
  }
});

test('faq<n>Question/faq<n>Answer works with resolved Humata copy without changing its routes', async () => {
  // No phase 1 page uses this spelling. Exercise the shared API with the real
  // untouched Humata content; compliance/real-estate's Q/A variant is covered above.
  const HumataContent = loadSource('app/compare/humata/HumataContent.tsx').default;
  for (const locale of MARKETING_LOCALES) {
    const { t } = await getServerT(locale);
    const content = await HumataContent({ locale });
    const items = [1, 2, 3, 4].map((n) => ({
      question: t(`compareHumata.faq${n}Question`), answer: t(`compareHumata.faq${n}Answer`),
    }));
    const blocks = await emittedSchemas(MarketingPageJsonLd({
      locale, path: '/compare/humata',
      title: t('compareHumata.heroTitle'), description: t('compareHumata.heroDescription'), faqItems: items,
    }));
    assert.deepEqual(faqEntries(blocks.find((block) => block['@type'] === 'FAQPage')),
      findElement(content, 'EdFaqList').props.items);
  }
});

test('absent or empty optional inputs emit no block; unavailable routes stay unprefixed', async () => {
  const props = { locale: 'ja', path: '/about', title: 'Title', description: 'Description' };
  for (const optional of [{}, { faqItems: [], breadcrumbs: [] }]) {
    const blocks = await emittedSchemas(MarketingPageJsonLd({ ...props, ...optional }));
    assert.deepEqual(schemaTypes(blocks), ['Article']);
    assert.equal(blocks[0].mainEntityOfPage['@id'], `${origin}/about`);
  }
  const blocks = await emittedSchemas(MarketingPageJsonLd({
    ...props, breadcrumbs: [{ label: 'About', path: '/about' }],
  }));
  assert.deepEqual(schemaTypes(blocks), ['Article', 'BreadcrumbList']);
  assert.equal(blocks[1].itemListElement[0].item, `${origin}/about`);
});

test('factory keeps generic Article output and metadata without a schema override', async () => {
  const HumataLocalePage = loadSource('app/[locale]/compare/humata/page.tsx');
  const blocks = await emittedSchemas(await HumataLocalePage.default({ params: { locale: 'ja' } }));
  assert.deepEqual(schemaTypes(blocks), ['Article']);
  assert.equal(blocks[0].mainEntityOfPage['@id'], `${origin}/ja/compare/humata`);
  const { t } = await getServerT('ja');
  const metadata = await HumataLocalePage.generateMetadata({ params: { locale: 'ja' } });
  assert.equal(metadata.title, t('compareHumata.heroTitle'));
  assert.equal(metadata.alternates.canonical, '/ja/compare/humata');
});

test('schema override preserves locale validation and localized metadata', async () => {
  const FinanceLocalePage = loadSource('app/[locale]/use-cases/finance/page.tsx');
  await assert.rejects(FinanceLocalePage.default({ params: { locale: 'invalid' } }), /NEXT_NOT_FOUND/);
  const { t } = await getServerT('ja');
  const metadata = await FinanceLocalePage.generateMetadata({ params: { locale: 'ja' } });
  assert.equal(metadata.title, t('useCasesFinance.heroTitle'));
  assert.equal(metadata.alternates.canonical, '/ja/use-cases/finance');
});
