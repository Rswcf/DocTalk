import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function ChatpdfJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`compareChatpdf.faq.q${n}`),
    answer: t(`compareChatpdf.faq.a${n}`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/compare/chatpdf"
      title={t('compareChatpdf.heroTitle')}
      description={t('compareChatpdf.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('compareChatpdf.breadcrumb.home'), path: '/' },
        { label: t('compareChatpdf.breadcrumb.compare'), path: '/compare' },
        { label: t('compareChatpdf.breadcrumb.current') },
      ]}
    />
  );
}
