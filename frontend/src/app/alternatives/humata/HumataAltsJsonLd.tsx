import { getServerT } from '../../../i18n/server';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import { absoluteUrl } from '../../../lib/seo';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function HumataAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const alternatives = [
    { position: 1, name: 'DocTalk', url: absoluteUrl(localizedHrefIfAvailable(locale, '/')) },
    { position: 2, name: 'ChatPDF', url: 'https://chatpdf.com' },
    { position: 3, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
    { position: 4, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
    { position: 5, name: 'PDF.ai', url: 'https://pdf.ai' },
  ];

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
      itemListItems={alternatives}
      breadcrumbs={[
        { label: t('altsHumata.breadcrumbHome'), path: '/' },
        { label: t('altsHumata.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsHumata.breadcrumbHumata') },
      ]}
    />
  );
}
