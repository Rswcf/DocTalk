import { getServerT } from '../../../i18n/server';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import { absoluteUrl } from '../../../lib/seo';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function ChatpdfAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const alternatives = [
    { position: 1, name: 'DocTalk', url: absoluteUrl(localizedHrefIfAvailable(locale, '/')) },
    { position: 2, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
    { position: 3, name: 'Humata', url: 'https://humata.ai' },
    { position: 4, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
    { position: 5, name: 'PDF.ai', url: 'https://pdf.ai' },
    { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
    { position: 7, name: 'Sharly', url: 'https://sharly.ai' },
  ];

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
      itemListItems={alternatives}
      breadcrumbs={[
        { label: t('altsChatpdf.breadcrumbHome'), path: '/' },
        { label: t('altsChatpdf.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsChatpdf.breadcrumbChatpdf') },
      ]}
    />
  );
}
