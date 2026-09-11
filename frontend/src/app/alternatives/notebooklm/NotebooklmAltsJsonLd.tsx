import { getServerT } from '../../../i18n/server';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import { absoluteUrl } from '../../../lib/seo';
import MarketingPageJsonLd from '../../../components/marketing/MarketingPageJsonLd';

export default async function NotebooklmAltsJsonLd({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);

  const alternatives = [
    { position: 1, name: 'DocTalk', url: absoluteUrl(localizedHrefIfAvailable(locale, '/')) },
    { position: 2, name: 'ChatPDF', url: 'https://chatpdf.com' },
    { position: 3, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
    { position: 4, name: 'Humata', url: 'https://humata.ai' },
    { position: 5, name: 'Consensus', url: 'https://consensus.app' },
    { position: 6, name: 'Elicit', url: 'https://elicit.com' },
  ];

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
      itemListItems={alternatives}
      breadcrumbs={[
        { label: t('altsNotebooklm.breadcrumbHome'), path: '/' },
        { label: t('altsNotebooklm.breadcrumbAlternatives'), path: '/alternatives' },
        { label: t('altsNotebooklm.breadcrumbNotebooklm') },
      ]}
    />
  );
}
