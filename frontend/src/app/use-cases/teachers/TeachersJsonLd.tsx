import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function TeachersJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`useCasesTeachers.faq.q${n}.question`),
    answer: t(`useCasesTeachers.faq.q${n}.answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/teachers"
      title={t('useCasesTeachers.heroTitle')}
      description={t('useCasesTeachers.heroDescription')}
      datePublished="2026-03-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesTeachers.breadcrumb.home'), path: '/' },
        { label: t('useCasesTeachers.breadcrumb.useCases'), path: '/use-cases' },
        { label: t('useCasesTeachers.breadcrumb.current') },
      ]}
    />
  );
}
