import { getServerT } from '../i18n/server';
import { localizedHref } from '../i18n/routing';
import { absoluteUrl } from '../lib/seo';
import { FAQ_ITEMS, HOW_IT_WORKS_STEPS } from '../components/landing/landingSchemaSources';

/**
 * Structured data for the landing page, English root and every locale alike.
 *
 * Before this existed, `app/page.tsx` hardcoded English FAQPage/SoftwareApplication/
 * HowTo blocks and `app/[locale]/page.tsx` emitted only WebSite + Organization, so
 * the ten translated home pages shipped without the rich types their own
 * translations already supported. Both now render this component.
 *
 * Every string resolves through the same keys (and the same `tOr` fallback) the
 * visible `FAQ` and `HowItWorks` sections use, so the schema always describes what
 * the page actually shows, in the page's own language.
 */

/** Bumped by hand when the product description materially changes. A live
 *  `new Date()` here made the markup differ on every build for no reader benefit. */
const DATE_MODIFIED = '2026-09-20';
const DATE_PUBLISHED = '2026-01-15';

export default async function HomeJsonLd({ locale }: { locale: string }) {
  const { t, tOr } = await getServerT(locale);
  const homeUrl = absoluteUrl(localizedHref(locale, '/'));
  const description = t('landing.description');

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'DocTalk',
        alternateName: 'DocTalk AI',
        url: homeUrl,
        inLanguage: locale,
        description,
      },
      {
        '@type': 'Organization',
        name: 'DocTalk',
        url: absoluteUrl('/'),
        logo: absoluteUrl('/logo-icon.png'),
        description,
        foundingDate: '2025',
        sameAs: ['https://github.com/Rswcf/DocTalk'],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@doctalk.site',
          contactType: 'customer support',
        },
      },
    ],
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: t(item.q),
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'fallback' in item ? tOr(item.a, item.fallback) : t(item.a),
      },
    })),
  };

  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    inLanguage: locale,
    name: 'DocTalk',
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Web',
    url: homeUrl,
    description,
    // Numeric pricing facts only. The old English offer names/descriptions and
    // `featureList` shipped untranslated on every locale page.
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      { '@type': 'Offer', price: '9.99', priceCurrency: 'USD' },
      { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' },
    ],
    datePublished: DATE_PUBLISHED,
    dateModified: DATE_MODIFIED,
  };

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    inLanguage: locale,
    name: t('landing.howItWorks.title'),
    description,
    step: HOW_IT_WORKS_STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: t(step.titleKey),
      text: t(step.descKey),
      url: `${homeUrl.replace(/\/$/, '')}/#how-it-works`,
    })),
  };

  return (
    <>
      {[graph, faq, software, howTo].map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
