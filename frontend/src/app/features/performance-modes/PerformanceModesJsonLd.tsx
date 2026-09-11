import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function PerformanceModesJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4].map((n) => ({
    question: t(`featuresPerformance.faq.q${n}`),
    answer: t(`featuresPerformance.faq.a${n}`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/features/performance-modes"
      title={t('featuresPerformance.hero.title')}
      description={t('featuresPerformance.hero.subtitle')}
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('footer.links.features'), path: '/features' },
        { label: t('featuresPerformance.hero.title') },
      ]}
      softwareApplication={{
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        path: '/',
        description: t('featuresPerformance.hero.subtitle'),
        // Keep numeric pricing facts; omit the old English offer prose.
        offers: [
          { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          { '@type': 'Offer', price: '9.99', priceCurrency: 'USD' },
          { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' },
        ],
      }}
    />
  );
}
