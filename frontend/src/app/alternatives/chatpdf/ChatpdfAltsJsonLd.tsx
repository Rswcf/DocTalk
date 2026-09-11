import { getServerT } from '../../../i18n/server';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function ChatpdfAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`altsChatpdf.faq${n}Question`),
    answer: t(`altsChatpdf.faq${n}Answer`),
  }));

  return (
    <MarketingPageJsonLd
      locale={locale}
      path="/alternatives/chatpdf"
      title={t('altsChatpdf.heroTitle')}
      description={t('altsChatpdf.heroDescription')}
      datePublished="2026-02-18"
      faqItems={faqItems}
      breadcrumbs={[
        { label: t('altsChatpdf.breadcrumbHome'), path: '/' },
        { label: t('altsChatpdf.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsChatpdf.breadcrumbChatpdf') },
      ]}
    />
  );
}
