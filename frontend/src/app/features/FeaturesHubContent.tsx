
import React from 'react';
import { getServerT } from '../../i18n/server';
import { getChromeStrings } from '../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../i18n/routing';
import MarketingLocaleLinks from '../../components/marketing/MarketingLocaleLinks';
import {
  Quote,
  FileStack,
  FileText,
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

export default async function FeaturesHubContent({ locale }: { locale: string }) {
  const { t, tOr } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

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
      slug: 'layout-translation',
      icon: FileText,
      title: tOr('featuresHub.layoutTranslationTitle', 'Layout-preserving PDF translation'),
      description: tOr('featuresHub.layoutTranslationDesc', 'Translate complex PDFs into a new PDF while keeping tables, formulas, figures, and page structure intact. Free includes 2 trials; Plus unlocks ongoing use.'),
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
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
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
            href: href(`/features/${f.slug}`),
          }))}
        />
      </EdSection>

      <EdSection alt title={t('featuresHub.workflowsTitle')}>
        <p className="ed-body">{t('featuresHub.workflowsDesc')}</p>
        <div style={{ marginTop: '24px' }}>
          <EdRelatedLinks
            links={[
              { href: href('/use-cases/students'), label: t('featuresHub.linkStudents') },
              { href: href('/use-cases/lawyers'), label: t('featuresHub.linkLawyers') },
              { href: href('/use-cases/finance'), label: t('featuresHub.linkFinance') },
              { href: href('/compare/chatpdf'), label: t('featuresHub.linkVsChatPDF') },
              { href: href('/blog/category/comparisons'), label: t('featuresHub.linkComparisons') },
            ]}
          />
        </div>
      </EdSection>

      <EdCtaBanner
        description={t('featuresHub.ctaText')}
        primary={{ label: t('featuresHub.ctaButton'), href: href('/demo') }}
      />
    
      <MarketingLocaleLinks path="/features" label={chrome.language} />
    </MarketingShell>
  );
}
