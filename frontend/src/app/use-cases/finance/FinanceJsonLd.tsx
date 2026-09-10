import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function FinanceJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  // FinanceContent renders its sixth FAQ only in English.
  const faqNumbers = locale === 'en' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const faqItems = faqNumbers.map((n) => ({
    question: t(`useCasesFinance.faq.q${n}.question`),
    answer: t(`useCasesFinance.faq.q${n}.answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/finance"
      title={t('useCasesFinance.heroTitle')}
      description={t('useCasesFinance.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesFinance.breadcrumb.home'), path: '/' },
        { label: t('useCasesFinance.breadcrumb.useCases'), path: '/use-cases' },
        { label: t('useCasesFinance.breadcrumb.current') },
      ]}
    />
  );
}
