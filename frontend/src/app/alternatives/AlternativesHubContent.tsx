
import React from 'react';
import { getServerT } from '../../i18n/server';
import { getChromeStrings } from '../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../i18n/routing';
import MarketingLocaleLinks from '../../components/marketing/MarketingLocaleLinks';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdCardGrid from '../../components/marketing/EdCardGrid';
import EdRelatedLinks from '../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

export default async function AlternativesHubContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const alternatives = [
    {
      slug: 'chatpdf',
      name: 'ChatPDF',
      tagline: t('altsHub.chatpdfTagline'),
      count: 7,
    },
    {
      slug: 'notebooklm',
      name: 'NotebookLM',
      tagline: t('altsHub.notebooklmTagline'),
      count: 6,
    },
    {
      slug: 'humata',
      name: 'Humata',
      tagline: t('altsHub.humataTagline'),
      count: 5,
    },
    {
      slug: 'askyourpdf',
      name: 'AskYourPDF',
      tagline: t('altsHub.askyourpdfTagline'),
      count: 7,
    },
    {
      slug: 'pdf-ai',
      name: 'PDF.ai',
      tagline: t('altsHub.pdfaiTagline'),
      count: 7,
    },
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
        { label: t('altsHub.title') },
      ]}
    >
      <EdPageHero title={t('altsHub.title')} lede={t('altsHub.subtitle')} />

      <EdSection>
        <EdCardGrid
          columns={2}
          items={alternatives.map((a) => ({
            label: t('altsHub.alternativesCompared', { count: a.count }),
            title: t('altsHub.alternativesFor', { name: a.name }),
            body: a.tagline,
            href: `/alternatives/${a.slug}`,
          }))}
        />
      </EdSection>

      <EdSection alt title={t('altsHub.decisionTitle')}>
        <p className="ed-body">{t('altsHub.decisionDescription')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdRelatedLinks
            links={[
              { href: href('/compare/chatpdf'), label: t('altsHub.linkVsChatpdf') },
              { href: href('/compare/notebooklm'), label: t('altsHub.linkVsNotebooklm') },
              { href: href('/features/multi-format'), label: t('altsHub.linkMultiFormat') },
              { href: href('/features/performance-modes'), label: t('altsHub.linkPerformanceModes') },
              { href: href('/pricing'), label: t('altsHub.linkPricing') },
            ]}
          />
        </div>
      </EdSection>

      <EdCtaBanner
        description={t('altsHub.comparePrompt')}
        primary={{ label: t('altsHub.viewComparisons'), href: href('/compare') }}
      />
    
      <MarketingLocaleLinks path="/alternatives" label={chrome.language} />
    </MarketingShell>
  );
}
