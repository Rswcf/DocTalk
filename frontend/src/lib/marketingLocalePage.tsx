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
 *     metaTitleKey: 'useCasesFinance.metaTitle',
 *     metaDescKey: 'useCasesFinance.metaDescription', keywords: [...] });
 *
 * metaTitleKey / metaDescKey are SEO-only keys: they drive <title>, <meta
 * description> and Open Graph, and nothing else. They must NOT be the keys the
 * hero renders. Until 2026-09-21 they were (titleKey/descKey pointed at
 * `heroTitle` / `heroDescription`), so rewriting a visible headline silently
 * rewrote that page's search title in all ten translated locales. The dedicated
 * `<ns>.metaTitle` / `<ns>.metaDescription` keys were seeded from the values
 * rendered at the time, so the split changed no metadata. The hero is now free
 * to change; the search title changes only when these keys do, deliberately.
 * The page's JSON-LD still follows the VISIBLE hero, by design
 * (tests/marketing-jsonld asserts Article.headline === EdPageHero.title).
 *   export const generateMetadata = page.generateMetadata;
 *   export default page.Page;
 */
export function createMarketingLocalePage({
  Content,
  path,
  metaTitleKey,
  metaDescKey,
  keywords,
  JsonLd,
}: {
  Content: (props: { locale: string }) => Promise<JSX.Element> | JSX.Element;
  path: string;
  metaTitleKey: string;
  metaDescKey: string;
  keywords?: string[];
  JsonLd: (props: { locale: string }) => Promise<JSX.Element> | JSX.Element;
}) {
  async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const { t } = await getServerT(params.locale);
    const title = t(metaTitleKey);
    const description = t(metaDescKey);
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
