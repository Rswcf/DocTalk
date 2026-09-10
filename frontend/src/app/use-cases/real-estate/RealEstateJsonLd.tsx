import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function RealEstateJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`useCasesRealEstate.faq${n}Q`),
    answer: t(`useCasesRealEstate.faq${n}A`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/real-estate"
      title={t('useCasesRealEstate.heroTitle')}
      description={t('useCasesRealEstate.heroLede')}
      datePublished="2026-03-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesRealEstate.breadcrumbHome'), path: '/' },
        { label: t('useCasesRealEstate.breadcrumbUseCases'), path: '/use-cases' },
        { label: t('useCasesRealEstate.breadcrumbCurrent') },
      ]}
    />
  );
}
