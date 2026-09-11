import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function PdfaiJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4].map((n) => ({
    question: t(`comparePdfai.faq${n}Question`),
    answer: t(`comparePdfai.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/compare/pdf-ai"
      title={t('comparePdfai.heroTitle')}
      description={t('comparePdfai.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('comparePdfai.breadcrumbHome'), path: '/' },
        { label: t('comparePdfai.breadcrumbCompare'), path: '/compare' },
        { label: t('comparePdfai.breadcrumbCurrent') },
      ]}
    />
  );
}
