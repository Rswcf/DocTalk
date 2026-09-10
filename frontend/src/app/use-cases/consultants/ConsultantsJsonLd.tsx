import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function ConsultantsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`useCasesConsultants.faq.q${n}.question`),
    answer: t(`useCasesConsultants.faq.q${n}.answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/consultants"
      title={t('useCasesConsultants.heroTitle')}
      description={t('useCasesConsultants.heroDescription')}
      datePublished="2026-03-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesConsultants.breadcrumb.home'), path: '/' },
        { label: t('useCasesConsultants.breadcrumb.useCases'), path: '/use-cases' },
        { label: t('useCasesConsultants.breadcrumb.current') },
      ]}
    />
  );
}
