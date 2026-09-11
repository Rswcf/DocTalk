import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function CitationsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`featuresCitations.faq${n}Q`),
    answer: t(`featuresCitations.faq${n}A`),
  }));

  // CitationsContent already renders these translated steps in every locale.
  const steps = [1, 2, 3].map((n) => ({
    name: t(`featuresCitations.howStep${n}Title`),
    text: t(`featuresCitations.howStep${n}Desc`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/features/citations"
      title={t('featuresCitations.heroTitle')}
      description={t('featuresCitations.heroSubtitle')}
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('footer.links.features'), path: '/features' },
        { label: t('featuresCitations.heroTitle') },
      ]}
      softwareApplication={{
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        path: '/',
        description: t('featuresCitations.heroSubtitle'),
        // Keep numeric pricing facts; omit the old English offer prose.
        offers: [
          { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          { '@type': 'Offer', price: '9.99', priceCurrency: 'USD' },
          { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' },
        ],
      }}
      howTo={{
        name: t('featuresCitations.howTitle'),
        description: t('featuresCitations.howSubtitle'),
        steps,
      }}
    />
  );
}
