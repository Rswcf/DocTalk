import JsonLdScript from '../JsonLdScript';
import { localizedHrefIfAvailable } from '../../i18n/routing';
import { absoluteUrl } from '../../lib/seo';

interface MarketingPageJsonLdProps {
  locale: string;
  path: string;
  title: string;
  description: string;
  faqItems?: { question: string; answer: string }[];
  breadcrumbs?: { label: string; path?: string }[];
  datePublished?: string;
}

/**
 * Locale-aware marketing schema. Callers resolve copy from their visible
 * content's translation keys; this component never infers a FAQ key convention.
 * Omitted or empty optional lists emit no corresponding schema block.
 */
export default function MarketingPageJsonLd({
  locale,
  path,
  title,
  description,
  faqItems,
  breadcrumbs,
  datePublished = '2026-02-18',
}: MarketingPageJsonLdProps) {
  const url = (value: string) => absoluteUrl(localizedHrefIfAvailable(locale, value));

  return (
    <>
      <JsonLdScript data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        inLanguage: locale,
        image: url('/opengraph-image'),
        datePublished,
        dateModified: datePublished,
        author: { '@type': 'Organization', name: 'DocTalk', url: url('/') },
        publisher: {
          '@type': 'Organization',
          name: 'DocTalk',
          url: url('/'),
          logo: url('/logo-icon.png'),
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url(path) },
      }} />
      {faqItems?.length ? (
        <JsonLdScript data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          inLanguage: locale,
          mainEntity: faqItems.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        }} />
      ) : null}
      {breadcrumbs?.length ? (
        <JsonLdScript data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          // No `inLanguage`: schema.org documents it for CreativeWork and kin,
          // while BreadcrumbList inherits ItemList -> Intangible -> Thing, so the
          // property is outside its domain. Article and FAQPage keep it. The
          // breadcrumb is still localised — its names are translated and its item
          // URLs are locale-correct (Codex r1 note).
          itemListElement: breadcrumbs.map(({ label, path: breadcrumbPath }, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: label,
            ...(breadcrumbPath ? { item: url(breadcrumbPath) } : {}),
          })),
        }} />
      ) : null}
    </>
  );
}
