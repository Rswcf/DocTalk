import React from 'react';
import { Download, Languages, ScanText } from 'lucide-react';
import type { ChromeStrings } from '../../../i18n/chrome';
import { localizedHrefIfAvailable } from '../../../i18n/routing';
import MarketingLocaleLinks from '../../../components/marketing/MarketingLocaleLinks';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdProse from '../../../components/marketing/EdProse';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';
import { billingHref } from '../../../lib/billingLinks';

type T = (key: string, params?: Record<string, string | number>) => string;
type TOr = (key: string, fallback: string, params?: Record<string, string | number>) => string;

export default function LayoutTranslationPageContent({
  locale,
  t,
  tOr,
  chrome,
  languageLabel,
}: {
  locale: string;
  t: T;
  tOr: TOr;
  chrome?: ChromeStrings;
  languageLabel?: string;
}) {
  const href = (p: string) => localizedHrefIfAvailable(locale, p);

  return (
    <MarketingShell
      chrome={chrome}
      breadcrumb={[
        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
        { label: t('featuresHub.heroTitle'), href: href('/features') },
        { label: tOr('featuresLayoutTranslation.heroTitle', 'Layout-preserving PDF translation') },
      ]}
    >
      <EdPageHero
        eyebrow={tOr('featuresLayoutTranslation.eyebrow', 'Plus workflow')}
        title={tOr('featuresLayoutTranslation.heroTitle', 'Layout-preserving PDF translation')}
        lede={tOr(
          'featuresLayoutTranslation.heroSubtitle',
          'Turn text-heavy PDFs into translated PDFs while keeping page structure, equations, citations, and visual context.',
        )}
      />

      <EdSection>
        <EdCardGrid
          columns={3}
          items={[
            {
              icon: ScanText,
              title: tOr('featuresLayoutTranslation.card1Title', 'Reads scanned and complex PDFs'),
              body: tOr('featuresLayoutTranslation.card1Body', 'The workflow runs OCR before translation, so image-heavy academic papers and reports can still be processed.'),
            },
            {
              icon: Languages,
              title: tOr('featuresLayoutTranslation.card2Title', 'Translates with layout context'),
              body: tOr('featuresLayoutTranslation.card2Body', 'Body text, equations, code-like blocks, and citations are translated with layout context instead of a plain text dump.'),
            },
            {
              icon: Download,
              title: tOr('featuresLayoutTranslation.card3Title', 'Previews and exports a translated PDF'),
              body: tOr('featuresLayoutTranslation.card3Body', 'Preview the translated PDF in DocTalk, download it, or add it as a new DocTalk document when you want to chat with the translated version.'),
            },
          ]}
        />
      </EdSection>

      <EdSection alt title={tOr('featuresLayoutTranslation.trialTitle', 'Free users can try it twice')}>
        <EdProse>
          <p>
            {tOr(
              'featuresLayoutTranslation.trialBody',
              'Every free account includes 2 layout-preserving PDF translations. After that, the workflow becomes a Plus and Pro feature, which makes it a concrete upgrade reason for users who work with foreign-language papers, contracts, manuals, and reports.',
            )}
          </p>
          <p>
            {tOr(
              'featuresLayoutTranslation.scopeBody',
              'The workflow now supports multiple target languages. It is strongest on text-heavy papers, contracts, manuals, and reports; table-heavy forms and invoices still need human review.',
            )}
          </p>
        </EdProse>
      </EdSection>

      <EdCtaBanner
        description={tOr('featuresLayoutTranslation.ctaText', 'Translate the first two PDFs for free, then keep the workflow on Plus.')}
        primary={{ label: tOr('featuresLayoutTranslation.ctaButton', 'Upgrade to Plus'), href: billingHref({ plan: 'plus', source: 'features_layout_translation' }) }}
        secondary={{ label: t('pricing.tryDemo'), href: href('/demo') }}
      />

      <MarketingLocaleLinks path="/features/layout-translation" label={languageLabel ?? chrome?.language} />
    </MarketingShell>
  );
}
