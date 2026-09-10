import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function StudentsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`useCasesStudents.faq.q${n}`),
    answer: t(`useCasesStudents.faq.a${n}`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/use-cases/students"
      title={t('useCasesStudents.hero.title')}
      description={t('useCasesStudents.hero.subtitle')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('useCasesStudents.breadcrumb.home'), path: '/' },
        { label: t('useCasesStudents.breadcrumb.useCases'), path: '/use-cases' },
        { label: t('useCasesStudents.breadcrumb.current') },
      ]}
    />
  );
}
