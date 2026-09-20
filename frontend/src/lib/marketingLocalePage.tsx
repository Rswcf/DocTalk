import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerT } from '../i18n/server';
import { isUrlLocale } from '../i18n/routing';
import { buildMarketingMetadata } from './seo';

/**
 * Factory for `app/[locale]/<route>/page.tsx` files. Removes per-page boilerplate
 * for the localized marketing rollout: builds locale metadata (title/description
 * from translation keys + hreflang via buildMarketingMetadata), validates the
 * locale, and renders the page's own JSON-LD component + the shared server
 * content component.
 * The `[locale]/layout.tsx` `generateStaticParams` supplies the locale
 * params, so page files need only metadata + the default component.
 *
 * `JsonLd` is REQUIRED. It used to be optional, falling back to a generic
 * Article-only component; `/features/layout-translation` was the one caller that
 * took the fallback, so its ten locale pages shipped without the FAQ/breadcrumb/
 * SoftwareApplication schema every sibling page emits. Making the prop required
 * moves that class of omission from "silently degraded at runtime" to a type
 * error at build time.
 *
 * Usage:
 *   const page = createMarketingLocalePage({ Content: FinanceContent,
 *     JsonLd: FinanceJsonLd, path: '/use-cases/finance',
 *     titleKey: 'useCasesFinance.heroTitle',
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
  JsonLd,
}: {
  Content: (props: { locale: string }) => Promise<JSX.Element> | JSX.Element;
  path: string;
  titleKey: string;
  descKey: string;
  keywords?: string[];
  JsonLd: (props: { locale: string }) => Promise<JSX.Element> | JSX.Element;
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
        <JsonLd locale={params.locale} />
        <Content locale={params.locale} />
      </>
    );
  }

  return { generateMetadata, Page };
}
