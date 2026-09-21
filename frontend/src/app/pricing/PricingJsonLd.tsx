import { getServerT } from '../../i18n/server';
import MarketingPageJsonLd from '../../components/marketing/MarketingPageJsonLd';

export default async function PricingJsonLd({ locale }: { locale: string }) {
  const { t, tOr } = await getServerT(locale);
  // One source for the hero line, so the hero and both schema blocks cannot drift.
  const heroLine = tOr(
    'pricing.heroLine',
    'Every plan answers with a citation you can open. Paid tiers raise the limits.',
  );

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/pricing"
      title={t('pricing.headline')}
      // Structured data must describe what the hero visibly says:
      // tests/marketing-jsonld asserts BOTH Article.description and
      // SoftwareApplication.description === EdPageHero.lede. The hero's one line
      // is pricing.heroLine since the 2026-09-20 restructure, so both follow it
      // (HERO_LINE below). Only the <meta description> -- descKey
      // 'pricing.description' in app/[locale]/pricing/page.tsx -- is
      // deliberately unchanged, so this page's search snippet does not move.
      description={heroLine}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('pricing.eyebrow') },
      ]}
      softwareApplication={{
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        path: '/pricing',
        description: heroLine,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: '0',
          highPrice: '19.99',
          offerCount: 3,
          offers: [
            {
              '@type': 'Offer',
              name: t('pricing.free.name'),
              price: '0',
              priceCurrency: 'USD',
              description: t('pricing.free.summary'),
            },
            {
              '@type': 'Offer',
              name: t('pricing.plus.name'),
              price: '9.99',
              priceCurrency: 'USD',
              description: t('pricing.plus.summary'),
            },
            {
              '@type': 'Offer',
              name: t('pricing.pro.name'),
              price: '19.99',
              priceCurrency: 'USD',
              description: t('pricing.pro.summary'),
            },
          ],
        },
      }}
    />
  );
}
