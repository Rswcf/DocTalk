import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function NotebooklmAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`altsNotebooklm.faq${n}Question`),
    answer: t(`altsNotebooklm.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/alternatives/notebooklm"
      title={t('altsNotebooklm.heroTitle')}
      description={t('altsNotebooklm.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('altsNotebooklm.breadcrumbHome'), path: '/' },
        { label: t('altsNotebooklm.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsNotebooklm.breadcrumbNotebooklm') },
      ]}
    />
  );
}
