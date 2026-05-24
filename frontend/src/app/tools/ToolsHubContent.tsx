
import React from 'react';
import { LetterText, Clock } from 'lucide-react';
import { getServerT } from '../../i18n/server';
import { getChromeStrings } from '../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../i18n/routing';
import MarketingLocaleLinks from '../../components/marketing/MarketingLocaleLinks';
import MarketingShell from '../../components/marketing/MarketingShell';
import EdPageHero from '../../components/marketing/EdPageHero';
import EdSection from '../../components/marketing/EdSection';
import EdCardGrid from '../../components/marketing/EdCardGrid';
import EdCheckList from '../../components/marketing/EdCheckList';
import EdRelatedLinks from '../../components/marketing/EdRelatedLinks';
import EdCtaBanner from '../../components/marketing/EdCtaBanner';

export default async function ToolsHubContent({ locale }: { locale: string }) {
  const { t } = await getServerT(locale);
  const chrome = await getChromeStrings(locale);
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  const tools = [
    {
      slug: 'word-counter',
      icon: LetterText,
      title: t('toolsHub.wordCounterTitle'),
      description: t('toolsHub.wordCounterDescription'),
      meta: t('toolsHub.wordCounterMeta'),
    },
    {
      slug: 'reading-time',
      icon: Clock,
      title: t('toolsHub.readingTimeTitle'),
      description: t('toolsHub.readingTimeDescription'),
      meta: t('toolsHub.readingTimeMeta'),
    },
  ];

  const proofPoints = [
    t('toolsHub.proofBrowserOnly'),
    t('toolsHub.proofDocumentWorkflows'),
    t('toolsHub.proofHandoffAi'),
  ];

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('toolsHub.breadcrumbHome'), href: href('/') },
        { label: t('toolsHub.breadcrumbTools') },
      ]}
    >
      <EdPageHero
        eyebrow={t('toolsHub.heroEyebrow')}
        title={t('toolsHub.heroTitle')}
        lede={t('toolsHub.heroLede')}
      />

      <EdSection>
        <EdCheckList items={proofPoints} />
      </EdSection>

      <EdSection alt title={t('toolsHub.availableToolsTitle')}>
        <p className="ed-lede" style={{ marginBottom: '32px' }}>
          {t('toolsHub.availableToolsLede')}
        </p>
        <EdCardGrid
          columns={2}
          items={tools.map((tool) => ({
            label: tool.meta,
            title: tool.title,
            body: tool.description,
            icon: tool.icon,
            href: `/tools/${tool.slug}`,
          }))}
        />
      </EdSection>

      <EdSection>
        <EdRelatedLinks
          links={[
            { href: href('/features/multi-format'), label: t('toolsHub.relatedMultiFormat') },
            { href: href('/features/citations'), label: t('toolsHub.relatedCitations') },
            { href: href('/use-cases/students'), label: t('toolsHub.relatedStudents') },
            { href: href('/pricing'), label: t('toolsHub.relatedPricing') },
          ]}
        />
      </EdSection>

      <EdCtaBanner
        title={t('toolsHub.ctaTitle')}
        description={t('toolsHub.ctaDescription')}
        primary={{ label: t('toolsHub.ctaPrimary'), href: href('/demo') }}
        secondary={{ label: t('toolsHub.ctaSecondary'), href: href('/features') }}
      />
    
      <MarketingLocaleLinks path="/tools" label={chrome.language} />
    </MarketingShell>
  );
}
