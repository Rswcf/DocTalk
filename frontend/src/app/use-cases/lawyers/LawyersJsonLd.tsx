import { getServerT } from '../../../i18n/server';
import { absoluteUrl } from '../../../lib/seo';
import { localizedHrefIfAvailable } from '../../../i18n/routing';

/**
 * Locale-aware structured data for the lawyers use-case page. FAQ entries are
 * resolved from the same translation keys the visible FAQ uses, and every URL
 * points at the current locale's page, so the JSON-LD matches what the user
 * sees in their language (Google flags content/markup mismatches).
 */
export default async function LawyersJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const url = (path: string) => absoluteUrl(localizedHrefIfAvailable(locale, path));
  const pageUrl = url('/use-cases/lawyers');

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`useCasesLawyers.faq.q${n}.question`),
    answer: t(`useCasesLawyers.faq.q${n}.answer`),
  }));

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: t('useCasesLawyers.heroTitle'),
    description: t('useCasesLawyers.heroDescription'),
    image: absoluteUrl('/opengraph-image'),
    datePublished: '2026-02-18',
    dateModified: '2026-02-18',
    inLanguage: locale,
    author: { '@type': 'Organization', name: 'DocTalk', url: absoluteUrl('/') },
    publisher: {
      '@type': 'Organization',
      name: 'DocTalk',
      url: absoluteUrl('/'),
      logo: absoluteUrl('/logo-icon.png'),
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('useCasesLawyers.breadcrumb.home'), item: url('/') },
      { '@type': 'ListItem', position: 2, name: t('useCasesLawyers.breadcrumb.useCases'), item: url('/use-cases') },
      { '@type': 'ListItem', position: 3, name: t('useCasesLawyers.breadcrumb.current') },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </>
  );
}
