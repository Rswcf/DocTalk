import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function HumataJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4].map((n) => ({
    question: t(`compareHumata.faq${n}Question`),
    answer: t(`compareHumata.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/compare/humata"
      title={t('compareHumata.heroTitle')}
      description={t('compareHumata.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('compareHumata.breadcrumbHome'), path: '/' },
        { label: t('compareHumata.breadcrumbCompare'), path: '/compare' },
        { label: t('compareHumata.breadcrumbCurrent') },
      ]}
    />
  );
}
