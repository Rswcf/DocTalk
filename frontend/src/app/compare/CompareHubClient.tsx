"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdCardGrid from '../../components/marketing/EdCardGrid';
import EdRelatedLinks from '../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

export default function CompareHubClient() {
  const { t } = useLocale();

  const comparisons = [
    {
      slug: 'chatpdf',
      name: 'ChatPDF',
      taglineKey: 'compareHub.tagline.chatpdf',
    },
    {
      slug: 'askyourpdf',
      name: 'AskYourPDF',
      taglineKey: 'compareHub.tagline.askyourpdf',
    },
    {
      slug: 'notebooklm',
      name: 'NotebookLM',
      taglineKey: 'compareHub.tagline.notebooklm',
    },
    {
      slug: 'humata',
      name: 'Humata',
      taglineKey: 'compareHub.tagline.humata',
    },
    {
      slug: 'pdf-ai',
      name: 'PDF.ai',
      taglineKey: 'compareHub.tagline.pdfai',
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('compareHub.heroTitle') },
      ]}
    >
      <EdPageHero
        title={t('compareHub.heroTitle')}
        lede={t('compareHub.heroDescription')}
      />

      <EdSection>
        <EdCardGrid
          columns={2}
          items={comparisons.map((c) => ({
            title: t('compareHub.vsLabel', { name: c.name }),
            body: t(c.taglineKey),
            href: `/compare/${c.slug}`,
          }))}
        />
      </EdSection>

      <EdSection alt title={t('compareHub.widenTitle')}>
        <p className="ed-body">{t('compareHub.widenDescription')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdRelatedLinks
            links={[
              { href: '/alternatives', label: t('compareHub.link.alternativesHub') },
              { href: '/blog/category/comparisons', label: t('compareHub.link.comparisonGuides') },
              { href: '/features/citations', label: t('compareHub.link.citationHighlighting') },
              { href: '/features/multilingual', label: t('compareHub.link.languageSupport') },
              { href: '/pricing', label: t('compareHub.link.pricingOverview') },
            ]}
          />
        </div>
      </EdSection>

      <EdCtaBanner
        description={t('compareHub.alternativesPrompt')}
        primary={{ label: t('compareHub.browseAlternatives'), href: '/alternatives' }}
      />
    </MarketingShell>
  );
}
