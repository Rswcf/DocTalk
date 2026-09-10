import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function HealthcareJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`useCasesHealthcare.faq.q${n}.question`),
    answer: t(`useCasesHealthcare.faq.q${n}.answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/healthcare"
      title={t('useCasesHealthcare.heroTitle')}
      description={t('useCasesHealthcare.heroDescription')}
      datePublished="2026-03-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesHealthcare.breadcrumb.home'), path: '/' },
        { label: t('useCasesHealthcare.breadcrumb.useCases'), path: '/use-cases' },
        { label: t('useCasesHealthcare.breadcrumb.current') },
      ]}
    />
  );
}
