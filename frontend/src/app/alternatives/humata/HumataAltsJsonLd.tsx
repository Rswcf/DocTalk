import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function HumataAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`altsHumata.faq${n}Question`),
    answer: t(`altsHumata.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/alternatives/humata"
      title={t('altsHumata.heroTitle')}
      description={t('altsHumata.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('altsHumata.breadcrumbHome'), path: '/' },
        { label: t('altsHumata.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsHumata.breadcrumbHumata') },
      ]}
    />
  );
}
