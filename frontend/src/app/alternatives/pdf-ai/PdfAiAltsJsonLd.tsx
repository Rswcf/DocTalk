import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function PdfAiAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`altsPdfai.faq${n}Question`),
    answer: t(`altsPdfai.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/alternatives/pdf-ai"
      title={t('altsPdfai.heroTitle')}
      description={t('altsPdfai.heroDescription')}
      datePublished="2026-03-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('altsPdfai.breadcrumbHome'), path: '/' },
        { label: t('altsPdfai.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsPdfai.breadcrumbPdfai') },
      ]}
    />
  );
}
