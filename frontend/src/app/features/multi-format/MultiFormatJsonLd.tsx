import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function MultiFormatJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`featuresMultiFormat.faq${n}Q`),
    answer: t(`featuresMultiFormat.faq${n}A`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/features/multi-format"
      title={t('featuresMultiFormat.heroTitle')}
      description={t('featuresMultiFormat.heroSubtitle')}
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('footer.links.features'), path: '/features' },
        { label: t('featuresMultiFormat.heroTitle') },
      ]}
      softwareApplication={{
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        path: '/',
        description: t('featuresMultiFormat.heroSubtitle'),
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
