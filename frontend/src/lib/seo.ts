import type { Metadata } from 'next';
import { URL_LOCALES, localizedHref } from '../i18n/routing';

export const SITE_URL = 'https://www.doctalk.site';
export const DEFAULT_SHARE_ALT = 'DocTalk — AI Document Chat with Cited Answers';
const DEFAULT_OG_IMAGE_PATH = '/opengraph-image';
const DEFAULT_TWITTER_IMAGE_PATH = '/twitter-image';
const BLOG_PLACEHOLDER_IMAGE = '/blog/images/placeholder.png';

type OpenGraphInput = NonNullable<Metadata['openGraph']>;
type TwitterInput = NonNullable<Metadata['twitter']>;

interface MarketingMetadataOptions {
  title: Metadata['title'];
  description: string;
  path: string;
  keywords?: string[];
  robots?: Metadata['robots'];
  openGraph?: Partial<OpenGraphInput>;
  twitter?: Partial<TwitterInput>;
  locale?: string;
  /**
   * When true, emit hreflang `alternates.languages` for every marketing locale
   * and set the canonical to this locale's URL. `path` is the locale-agnostic
   * path (e.g. `/use-cases/lawyers`); `locale` is the page's locale (default `en`).
   */
  localized?: boolean;
}

/** hreflang map: unprefixed `en` default + each URL locale + `x-default` → en. */
function buildLanguageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    en: absoluteUrl(localizedHref('en', path)),
  };
  for (const loc of URL_LOCALES) {
    languages[loc] = absoluteUrl(localizedHref(loc, path));
  }
  languages['x-default'] = absoluteUrl(localizedHref('en', path));
  return languages;
}

const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  zh: 'zh_CN',
  es: 'es_ES',
  ja: 'ja_JP',
  de: 'de_DE',
  fr: 'fr_FR',
  ko: 'ko_KR',
  pt: 'pt_BR',
  it: 'it_IT',
  ar: 'ar_SA',
  hi: 'hi_IN',
};

interface ArticleJsonLdOptions {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  imagePath?: string;
  keywords?: string[];
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return new URL(path.startsWith('/') ? path : `/${path}`, SITE_URL).toString();
}

export function resolveShareImage(imagePath?: string): string {
  if (!imagePath || imagePath === BLOG_PLACEHOLDER_IMAGE) {
    return absoluteUrl(DEFAULT_OG_IMAGE_PATH);
  }

  return absoluteUrl(imagePath);
}

function resolveTitleText(title: Metadata['title']): string {
  if (typeof title === 'string') {
    return title;
  }

  if (title && typeof title === 'object') {
    if ('absolute' in title && title.absolute) {
      return title.absolute;
    }

    if ('default' in title && title.default) {
      return title.default;
    }
  }

  return 'DocTalk';
}

export function buildMarketingMetadata({
  title,
  description,
  path,
  keywords,
  robots,
  openGraph,
  twitter,
  locale,
  localized,
}: MarketingMetadataOptions): Metadata {
  const titleText = resolveTitleText(title);
  const pageLocale = locale ?? 'en';
  const canonicalPath = localized ? localizedHref(pageLocale, path) : path;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: {
      canonical: canonicalPath,
      ...(localized ? { languages: buildLanguageAlternates(path) } : {}),
    },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: titleText,
      description,
      url: absoluteUrl(canonicalPath),
      siteName: 'DocTalk',
      locale: OG_LOCALE_MAP[pageLocale] ?? 'en_US',
      images: [
        {
          url: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
          width: 1200,
          height: 630,
          alt: DEFAULT_SHARE_ALT,
        },
      ],
      ...openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title: titleText,
      description,
      images: [absoluteUrl(DEFAULT_TWITTER_IMAGE_PATH)],
      ...twitter,
    },
  };
}

export function buildArticleJsonLd({
  title,
  description,
  path,
  datePublished,
  dateModified,
  authorName = 'DocTalk Team',
  imagePath,
  keywords,
}: ArticleJsonLdOptions) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: resolveShareImage(imagePath),
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      '@type': 'Organization',
      name: authorName,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DocTalk',
      url: SITE_URL,
      logo: absoluteUrl('/logo-icon.png'),
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(path),
    },
    ...(keywords?.length ? { keywords: keywords.join(', ') } : {}),
  };
}
