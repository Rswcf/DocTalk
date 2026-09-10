import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function HrContractsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4].map((n) => ({
    question: t(`useCasesHr.faq.q${n}`),
    answer: t(`useCasesHr.faq.a${n}`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/hr-contracts"
      title={t('useCasesHr.hero.title')}
      description={t('useCasesHr.hero.subtitle')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesHr.breadcrumb.home'), path: '/' },
        { label: t('useCasesHr.breadcrumb.useCases'), path: '/use-cases' },
        { label: t('useCasesHr.breadcrumb.current') },
      ]}
    />
  );
}
