import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function NotebooklmJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`compareNotebooklm.faq.q${n}`),
    answer: t(`compareNotebooklm.faq.a${n}`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/compare/notebooklm"
      title={t('compareNotebooklm.heroTitle')}
      description={t('compareNotebooklm.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('compareNotebooklm.breadcrumb.home'), path: '/' },
        { label: t('compareNotebooklm.breadcrumb.compare'), path: '/compare' },
        { label: t('compareNotebooklm.breadcrumb.current') },
      ]}
    />
  );
}
