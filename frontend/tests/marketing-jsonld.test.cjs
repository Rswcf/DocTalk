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
  if ((filename.includes('/components/marketing/')
    && !/JsonLd\.tsx$/.test(filename) && !filename.endsWith('/EdFaqList.tsx'))
    || filename.endsWith('/demo/DemoPageClient.tsx')) {
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
      // Neither BreadcrumbList nor ItemList descends from CreativeWork;
      // both inherit Intangible -> Thing and must NOT carry inLanguage.
      for (const block of blocks) {
        if (['BreadcrumbList', 'ItemList'].includes(block['@type'])) {
          assert.ok(!('inLanguage' in block), `${block['@type']} must not carry inLanguage`);
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

test('faq<n>Question/faq<n>Answer works with resolved Humata copy', async () => {
  // Exercise explicitly resolved copy through the shared API as well as the
  // real route coverage below; no helper infers the key convention.
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
  for (const optional of [{}, { faqItems: [], breadcrumbs: [], itemListItems: [] }]) {
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

test('ItemList preserves supplied positions, product names and resolved URLs', async () => {
  const itemListItems = [
    { position: 2, name: 'DocTalk', url: `${origin}/ja` },
    { position: 4, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
  ];
  const blocks = await emittedSchemas(MarketingPageJsonLd({
    locale: 'ja', path: '/alternatives/chatpdf', title: 'Title', description: 'Description', itemListItems,
  }));
  assert.deepEqual(schemaTypes(blocks), ['Article', 'ItemList']);
  assert.deepEqual(blocks[1], {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: itemListItems.map((item) => ({ '@type': 'ListItem', ...item })),
  });
  assert.ok(!('inLanguage' in blocks[1]), 'ItemList must not carry inLanguage');
});

test('factory keeps generic Article output and metadata without a schema override', async () => {
  const LayoutTranslationLocalePage = loadSource('app/[locale]/features/layout-translation/page.tsx');
  const blocks = await emittedSchemas(await LayoutTranslationLocalePage.default({ params: { locale: 'ja' } }));
  assert.deepEqual(schemaTypes(blocks), ['Article']);
  assert.equal(blocks[0].mainEntityOfPage['@id'], `${origin}/ja/features/layout-translation`);
  const { t } = await getServerT('ja');
  const metadata = await LayoutTranslationLocalePage.generateMetadata({ params: { locale: 'ja' } });
  assert.equal(metadata.title, t('featuresLayoutTranslation.heroTitle'));
  assert.equal(metadata.alternates.canonical, '/ja/features/layout-translation');
});

test('schema override preserves locale validation and localized metadata', async () => {
  const FinanceLocalePage = loadSource('app/[locale]/use-cases/finance/page.tsx');
  await assert.rejects(FinanceLocalePage.default({ params: { locale: 'invalid' } }), /NEXT_NOT_FOUND/);
  const { t } = await getServerT('ja');
  const metadata = await FinanceLocalePage.generateMetadata({ params: { locale: 'ja' } });
  assert.equal(metadata.title, t('useCasesFinance.heroTitle'));
  assert.equal(metadata.alternates.canonical, '/ja/use-cases/finance');
});

const phase2Cases = [
  ['alternatives', 'AlternativesHubContent', 0],
  ['alternatives/askyourpdf', 'AskyourpdfAltsContent', 5],
  ['alternatives/chatpdf', 'ChatpdfAltsContent', 5],
  ['alternatives/humata', 'HumataAltsContent', 5],
  ['alternatives/notebooklm', 'NotebooklmAltsContent', 5],
  ['alternatives/pdf-ai', 'PdfAiAltsContent', 5],
  ['compare', 'CompareHubContent', 0],
  ['compare/askyourpdf', 'AskyourpdfContent', 4],
  ['compare/chatpdf', 'ChatpdfContent', 5],
  ['compare/humata', 'HumataContent', 4],
  ['compare/notebooklm', 'NotebooklmContent', 5],
  ['compare/pdf-ai', 'PdfaiContent', 4],
  ['features', 'FeaturesHubContent', 0],
  ['features/citations', 'CitationsContent', 5, true],
  ['features/free-demo', 'FreeDemoContent', 5, true],
  ['features/multi-format', 'MultiFormatContent', 5, true],
  ['features/multilingual', 'MultilingualContent', 4, true],
  ['features/performance-modes', 'PerformanceModesContent', 4, true],
  ['demo', null, 0], // Client content is checked in the built-HTML verification.
  ['pricing', 'PricingPageContent', 0, true],
  ['tools', 'ToolsHubContent', 0],
  ['trust', 'TrustPageContent', 0],
];

for (const [route, contentName, count, software] of phase2Cases) {
  test(`/${route}: phase 2 EN/locale markup matches rendered copy in all 11 languages`, async () => {
    const folder = `app/${route}`;
    const Content = contentName ? loadSource(`${folder}/${contentName}.tsx`).default : null;
    const EnPage = loadSource(`${folder}/page.tsx`).default;
    const LocalePage = loadSource(`app/[locale]/${route}/page.tsx`).default;
    const expectedTypes = ['Article', ...(count ? ['FAQPage'] : []), 'BreadcrumbList',
      ...(route.startsWith('alternatives/') ? ['ItemList'] : []),
      ...(software ? ['SoftwareApplication'] : []), ...(route === 'features/citations' ? ['HowTo'] : []),
      ...(route === 'tools' ? ['CollectionPage'] : [])];

    for (const locale of MARKETING_LOCALES) {
      const blocks = await emittedSchemas(locale === 'en' ? await EnPage()
        : await LocalePage({ params: { locale } }));
      assert.deepEqual(schemaTypes(blocks), expectedTypes, `${locale}: exactly one of each intended block`);
      for (const block of blocks) {
        if (['BreadcrumbList', 'ItemList'].includes(block['@type'])) {
          assert.ok(!('inLanguage' in block), `${block['@type']} must not carry inLanguage`);
        } else assert.equal(block.inLanguage, locale);
      }
      const pageUrl = `${origin}${locale === 'en' ? '' : `/${locale}`}/${route}`;
      const article = blocks.find((block) => block['@type'] === 'Article');
      assert.equal(article.mainEntityOfPage['@id'], pageUrl);
      assert.equal(article.image, `${origin}/opengraph-image`);
      assert.equal(article.publisher.logo, `${origin}/logo-icon.png`);

      const content = Content ? await Content({ locale }) : null;
      const { t } = await getServerT(locale);
      const hero = content ? findElement(content, 'EdPageHero').props
        : { title: t('demo.title'), lede: t('demo.subtitle') };
      assert.equal(article.headline, hero.title);
      assert.equal(article.description, hero.lede);
      const trail = content ? findElement(content, 'MarketingShell').props.breadcrumb : [
        { label: t('useCasesHub.breadcrumb.home'), href: locale === 'en' ? '/' : `/${locale}` },
        { label: t('footer.demo') },
      ];
      const breadcrumbs = blocks.find((block) => block['@type'] === 'BreadcrumbList');
      assert.deepEqual(breadcrumbs.itemListElement, trail.map(({ label, href }, index) => ({
        '@type': 'ListItem', position: index + 1, name: label,
        ...(href ? { item: `${origin}${href}` } : {}),
      })));
      const visibleFaq = findElement(content, 'EdFaqList');
      const faq = blocks.find((block) => block['@type'] === 'FAQPage');
      if (count) {
        assert.equal(visibleFaq.props.items.length, count);
        assert.deepEqual(faqEntries(faq), visibleFaq.props.items, `${locale}: exact FAQ text, order and count`);
        assert.equal(renderToStaticMarkup(React.createElement(EdFaqList, { items: faqEntries(faq) })),
          renderToStaticMarkup(visibleFaq));
      } else {
        assert.equal(visibleFaq, undefined);
        assert.equal(faq, undefined, 'Pages without a visible FAQ, especially /pricing, must omit FAQPage');
      }
      const application = blocks.find((block) => block['@type'] === 'SoftwareApplication');
      if (software) {
        assert.equal(application.description, hero.lede, 'Application description is the rendered translation');
        const applicationPath = route === 'pricing' ? '/pricing' : route === 'features/free-demo' ? '/demo' : '';
        assert.equal(application.url, `${origin}${locale === 'en' ? '' : `/${locale}`}${applicationPath || (locale === 'en' ? '/' : '')}`);
        if (route === 'pricing') {
          assert.deepEqual(application.offers.offers.map(({ name, description }) => ({ name, description })),
            ['free', 'plus', 'pro'].map((plan) => ({ name: t(`pricing.${plan}.name`), description: t(`pricing.${plan}.summary`) })));
          assert.deepEqual(application.offers.offers.map(({ price }) => price), ['0', '9.99', '19.99']);
        } else {
          for (const offer of [application.offers].flat()) assert.ok(!('description' in offer));
        }
      }
      if (route === 'features/citations') {
        const howTo = blocks.find((block) => block['@type'] === 'HowTo');
        const steps = findElement(content, 'EdStepRow').props.steps;
        assert.equal(howTo.name, t('featuresCitations.howTitle'));
        assert.equal(howTo.description, t('featuresCitations.howSubtitle'));
        assert.deepEqual(howTo.step, steps.map(({ title, body }, index) => ({
          '@type': 'HowToStep', position: index + 1, name: title, text: body,
        })));
        assert.ok(!faq.mainEntity.some(({ name }) => name === 'Does citation highlighting work with DOCX and PPTX?'));
        if (locale === 'en') assert.ok(faq.mainEntity.some(({ name }) => name === 'Does it work with DOCX and PPTX?'));
      }
      if (route === 'tools') {
        const collection = blocks.find((block) => block['@type'] === 'CollectionPage');
        assert.equal(collection.name, hero.title);
        assert.equal(collection.description, hero.lede);
        assert.equal(collection.url, pageUrl);
      }
    }
  });
}

test('SoftwareApplication permits absent description; HowTo requires every step to resolve', async () => {
  const props = { locale: 'ja', path: '/features/citations', title: '引用', description: '引用の検証' };
  const softwareApplication = {
    name: 'DocTalk', applicationCategory: 'ProductivityApplication', operatingSystem: 'Web', path: '/',
  };
  for (const description of [undefined, '', '引用の検証']) {
    const blocks = await emittedSchemas(MarketingPageJsonLd({
      ...props, softwareApplication: { ...softwareApplication, description },
    }));
    assert.deepEqual(schemaTypes(blocks), ['Article', 'SoftwareApplication']);
    assert.equal(blocks[1].description, description || undefined);
    assert.equal('description' in blocks[1], Boolean(description));
  }
  for (const howTo of [undefined, { name: '手順', steps: [] },
    { name: '', steps: [{ name: '質問', text: '入力' }] },
    { name: '手順', steps: [{ name: '質問', text: '入力' }, { name: '確認', text: '' }] }]) {
    const blocks = await emittedSchemas(MarketingPageJsonLd({ ...props, howTo }));
    assert.deepEqual(schemaTypes(blocks), ['Article'], 'Omit the whole unresolved HowTo, never a partial list');
  }
});

test('every phase 2 schema translation exists directly in its locale, without English fallback', async () => {
  const server = loadSource('i18n/server.ts');
  const original = server.getServerT;
  server.getServerT = async (locale) => {
    const translator = await original(locale);
    const messages = JSON.parse(fs.readFileSync(path.join(src, 'i18n/locales', `${locale}.json`), 'utf8'));
    return { ...translator, t(key, params) {
      assert.ok(Object.hasOwn(messages, key) && messages[key].trim(), `${locale}: unresolved schema key ${key}`);
      return translator.t(key, params);
    } };
  };
  try {
    for (const [route] of phase2Cases) {
      const EnPage = loadSource(`app/${route}/page.tsx`).default;
      const LocalePage = loadSource(`app/[locale]/${route}/page.tsx`).default;
      for (const locale of MARKETING_LOCALES) {
        await emittedSchemas(locale === 'en' ? await EnPage() : await LocalePage({ params: { locale } }));
      }
    }
  } finally {
    server.getServerT = original;
  }
});
