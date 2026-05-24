import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerT } from '../i18n/server';
import { isUrlLocale } from '../i18n/routing';
import { buildMarketingMetadata } from './seo';
import MarketingArticleJsonLd from '../components/marketing/MarketingArticleJsonLd';

/**
 * Factory for `app/[locale]/<route>/page.tsx` files. Removes per-page boilerplate
 * for the localized marketing rollout: builds locale metadata (title/description
 * from translation keys + hreflang via buildMarketingMetadata), validates the
 * locale, and renders generic Article JSON-LD + the shared server content
 * component. The `[locale]/layout.tsx` `generateStaticParams` supplies the locale
 * params, so page files need only metadata + the default component.
 *
 * Usage:
 *   const page = createMarketingLocalePage({ Content: FinanceContent,
 *     path: '/use-cases/finance', titleKey: 'useCasesFinance.heroTitle',
 *     descKey: 'useCasesFinance.heroDescription', keywords: [...] });
 *   export const generateMetadata = page.generateMetadata;
 *   export default page.Page;
 */
export function createMarketingLocalePage({
  Content,
  path,
  titleKey,
  descKey,
  keywords,
  datePublished,
}: {
  Content: (props: { locale: string }) => Promise<JSX.Element> | JSX.Element;
  path: string;
  titleKey: string;
  descKey: string;
  keywords?: string[];
  datePublished?: string;
}) {
  async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const { t } = await getServerT(params.locale);
    const title = t(titleKey);
    const description = t(descKey);
    return buildMarketingMetadata({
      title,
      description,
      path,
      locale: params.locale,
      localized: true,
      keywords,
      openGraph: { title: `${title} | DocTalk`, description },
    });
  }

  async function Page({ params }: { params: { locale: string } }) {
    if (!isUrlLocale(params.locale)) notFound();
    return (
      <>
        <MarketingArticleJsonLd
          locale={params.locale}
          path={path}
          titleKey={titleKey}
          descKey={descKey}
          datePublished={datePublished}
        />
        <Content locale={params.locale} />
      </>
    );
  }

  return { generateMetadata, Page };
}
