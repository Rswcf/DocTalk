import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

/**
 * Article + BreadcrumbList for /features/layout-translation.
 *
 * This page has no visible FAQ and no visible step list, so it emits neither —
 * structured data must describe what is on the page. It does carry the same
 * SoftwareApplication block as its five sibling `features/*` pages: that block
 * describes the product, not this page's copy, and the built-HTML verifier
 * encodes `features/* -> SoftwareApplication` as a rule. The title, description and
 * breadcrumb labels reuse the exact `t`/`tOr` calls (and fallbacks) that
 * `LayoutTranslationPageContent` renders, so the schema and the visible copy
 * cannot drift apart in any locale.
 */
export default async function LayoutTranslationJsonLd({ locale }: { locale: string }) {
  const { t, tOr } = await getServerT(locale);

  const title = tOr('featuresLayoutTranslation.heroTitle', 'Layout-preserving PDF translation');

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/features/layout-translation"
      title={title}
      description={tOr(
        'featuresLayoutTranslation.heroSubtitle',
        'Turn text-heavy PDFs into translated PDFs while keeping page structure, equations, citations, and visual context.',
      )}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('featuresHub.heroTitle'), path: '/features' },
        { label: title },
      ]}
      softwareApplication={{
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        path: '/',
        description: tOr(
          'featuresLayoutTranslation.heroSubtitle',
          'Turn text-heavy PDFs into translated PDFs while keeping page structure, equations, citations, and visual context.',
        ),
        // Numeric pricing facts only, matching the five sibling feature pages.
        offers: [
          { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          { '@type': 'Offer', price: '9.99', priceCurrency: 'USD' },
          { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' },
        ],
      }}
    />
  );
}
