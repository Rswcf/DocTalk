import { getServerT } from '../../i18n/server';
import { absoluteUrl } from '../../lib/seo';
import { localizedHref } from '../../i18n/routing';

/**
 * Generic localized Article JSON-LD for marketing locale pages. Headline +
 * description come from the same translation keys the page's hero uses, so the
 * structured data matches the visible (translated) content. English root pages
 * keep their own richer hand-authored JSON-LD; this is the lean per-locale
 * counterpart used by the locale-page factory.
 */
export default async function MarketingArticleJsonLd({
  locale,
  path,
  titleKey,
  descKey,
  datePublished = '2026-02-18',
}: {
  locale: string;
  path: string;
  titleKey: string;
  descKey: string;
  datePublished?: string;
}) {
  const { t } = await getServerT(locale);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: t(titleKey),
    description: t(descKey),
    inLanguage: locale,
    image: absoluteUrl('/opengraph-image'),
    datePublished,
    dateModified: datePublished,
    author: { '@type': 'Organization', name: 'DocTalk', url: absoluteUrl('/') },
    publisher: {
      '@type': 'Organization',
      name: 'DocTalk',
      url: absoluteUrl('/'),
      logo: absoluteUrl('/logo-icon.png'),
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(localizedHref(locale, path)) },
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}
