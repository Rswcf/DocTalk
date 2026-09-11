import { getServerT } from '../../../i18n/server';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import { absoluteUrl } from '../../../lib/seo';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function PdfAiAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const alternatives = [
    { position: 1, name: 'DocTalk', url: absoluteUrl(localizedHrefIfAvailable(locale, '/')) },
    { position: 2, name: 'ChatPDF', url: 'https://www.chatpdf.com' },
    { position: 3, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
    { position: 4, name: 'Humata', url: 'https://humata.ai' },
    { position: 5, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
    { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
    { position: 7, name: 'Sharly', url: 'https://sharly.ai' },
  ];

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
      itemListItems={alternatives}
      breadcrumbs={[
        { label: t('altsPdfai.breadcrumbHome'), path: '/' },
        { label: t('altsPdfai.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsPdfai.breadcrumbPdfai') },
      ]}
    />
  );
}
