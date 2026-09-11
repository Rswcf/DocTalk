import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function AskyourpdfJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4].map((n) => ({
    question: t(`compareAskyourpdf.faq${n}Question`),
    answer: t(`compareAskyourpdf.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/compare/askyourpdf"
      title={t('compareAskyourpdf.heroTitle')}
      description={t('compareAskyourpdf.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('compareAskyourpdf.breadcrumbHome'), path: '/' },
        { label: t('compareAskyourpdf.breadcrumbCompare'), path: '/compare' },
        { label: t('compareAskyourpdf.breadcrumbCurrent') },
      ]}
    />
  );
}
