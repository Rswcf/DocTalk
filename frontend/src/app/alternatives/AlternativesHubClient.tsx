"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdCardGrid from '../../components/marketing/EdCardGrid';
import EdRelatedLinks from '../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

export default function AlternativesHubClient() {
  const { t } = useLocale();

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
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
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
              { href: '/compare/chatpdf', label: t('altsHub.linkVsChatpdf') },
              { href: '/compare/notebooklm', label: t('altsHub.linkVsNotebooklm') },
              { href: '/features/multi-format', label: t('altsHub.linkMultiFormat') },
              { href: '/features/performance-modes', label: t('altsHub.linkPerformanceModes') },
              { href: '/pricing', label: t('altsHub.linkPricing') },
            ]}
          />
        </div>
      </EdSection>

      <EdCtaBanner
        description={t('altsHub.comparePrompt')}
        primary={{ label: t('altsHub.viewComparisons'), href: '/compare' }}
      />
    </MarketingShell>
  );
}
