"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import {
  Quote,
  FileStack,
  Languages,
  PlayCircle,
  Gauge,
} from 'lucide-react';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdCardGrid from '../../components/marketing/EdCardGrid';
import EdRelatedLinks from '../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

export default function FeaturesHubClient() {
  const { t } = useLocale();

  const features = [
    {
      slug: 'citations',
      icon: Quote,
      title: t('featuresHub.citationsTitle'),
      description: t('featuresHub.citationsDesc'),
    },
    {
      slug: 'multi-format',
      icon: FileStack,
      title: t('featuresHub.multiFormatTitle'),
      description: t('featuresHub.multiFormatDesc'),
    },
    {
      slug: 'multilingual',
      icon: Languages,
      title: t('featuresHub.multilingualTitle'),
      description: t('featuresHub.multilingualDesc'),
    },
    {
      slug: 'free-demo',
      icon: PlayCircle,
      title: t('featuresHub.freeDemoTitle'),
      description: t('featuresHub.freeDemoDesc'),
    },
    {
      slug: 'performance-modes',
      icon: Gauge,
      title: t('featuresHub.performanceModesTitle'),
      description: t('featuresHub.performanceModesDesc'),
    },
  ];

  return (
    <MarketingShell
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
        { label: t('featuresHub.heroTitle') },
      ]}
    >
      <EdPageHero
        title={t('featuresHub.heroTitle')}
        lede={t('featuresHub.heroSubtitle')}
      />

      <EdSection>
        <EdCardGrid
          columns={3}
          items={features.map((f) => ({
            title: f.title,
            body: f.description,
            icon: f.icon,
            href: `/features/${f.slug}`,
          }))}
        />
      </EdSection>

      <EdSection alt title={t('featuresHub.workflowsTitle')}>
        <p className="ed-body">{t('featuresHub.workflowsDesc')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdRelatedLinks
            links={[
              { href: '/use-cases/students', label: t('featuresHub.linkStudents') },
              { href: '/use-cases/lawyers', label: t('featuresHub.linkLawyers') },
              { href: '/use-cases/finance', label: t('featuresHub.linkFinance') },
              { href: '/compare/chatpdf', label: t('featuresHub.linkVsChatPDF') },
              { href: '/blog/category/comparisons', label: t('featuresHub.linkComparisons') },
            ]}
          />
        </div>
      </EdSection>

      <EdCtaBanner
        description={t('featuresHub.ctaText')}
        primary={{ label: t('featuresHub.ctaButton'), href: '/demo' }}
      />
    </MarketingShell>
  );
}
