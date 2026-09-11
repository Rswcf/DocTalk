import { getServerT } from '../../i18n/server';
import MarketingPageJsonLd from '../../components/marketing/MarketingPageJsonLd';

export default async function PricingJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/pricing"
      title={t('pricing.headline')}
      description={t('pricing.description')}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('pricing.eyebrow') },
      ]}
      softwareApplication={{
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        path: '/pricing',
        description: t('pricing.description'),
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
