import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function FreeDemoJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`featuresDemo.faq.q${n}`),
    answer: t(`featuresDemo.faq.a${n}`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/features/free-demo"
      title={t('featuresDemo.hero.title')}
      description={t('featuresDemo.hero.subtitle')}
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesHub.breadcrumb.home'), path: '/' },
        { label: t('footer.links.features'), path: '/features' },
        { label: t('featuresDemo.hero.title') },
      ]}
      softwareApplication={{
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        path: '/demo',
        description: t('featuresDemo.hero.subtitle'),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }}
    />
  );
}
