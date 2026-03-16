import type { Metadata } from 'next';

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
}: MarketingMetadataOptions): Metadata {
  const titleText = resolveTitleText(title);

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: {
      canonical: path,
    },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: titleText,
      description,
      url: absoluteUrl(path),
      siteName: 'DocTalk',
      locale: locale ? (OG_LOCALE_MAP[locale] ?? 'en_US') : 'en_US',
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
