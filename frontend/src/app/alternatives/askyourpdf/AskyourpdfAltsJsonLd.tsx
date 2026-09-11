import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function AskyourpdfAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`altsAskyourpdf.faq${n}Question`),
    answer: t(`altsAskyourpdf.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/alternatives/askyourpdf"
      title={t('altsAskyourpdf.heroTitle')}
      description={t('altsAskyourpdf.heroDescription')}
      datePublished="2026-03-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('altsAskyourpdf.breadcrumbHome'), path: '/' },
        { label: t('altsAskyourpdf.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsAskyourpdf.breadcrumbAskyourpdf') },
      ]}
    />
  );
}
