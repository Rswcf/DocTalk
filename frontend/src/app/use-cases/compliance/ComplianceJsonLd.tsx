import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function ComplianceJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`useCasesCompliance.faq${n}Q`),
    answer: t(`useCasesCompliance.faq${n}A`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/compliance"
      title={t('useCasesCompliance.heroTitle')}
      description={t('useCasesCompliance.heroLede')}
      datePublished="2026-03-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesCompliance.breadcrumbHome'), path: '/' },
        { label: t('useCasesCompliance.breadcrumbUseCases'), path: '/use-cases' },
        { label: t('useCasesCompliance.breadcrumbCurrent') },
      ]}
    />
  );
}
