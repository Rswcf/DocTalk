import type { Metadata } from 'next';
import LayoutTranslationContent from './LayoutTranslationContent';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Layout-Preserving PDF Translation',
  description:
    'Translate complex PDFs while preserving layout, tables, formulas, figures, and page structure. Free accounts get 2 trials; Plus unlocks ongoing use.',
  path: '/features/layout-translation',
  localized: true,
  keywords: ['pdf translation with layout', 'translate academic pdf', 'layout preserving pdf translation'],
  openGraph: {
    title: 'Layout-Preserving PDF Translation | DocTalk',
  },
});

export default function LayoutTranslationPage() {
  return <LayoutTranslationContent locale="en" />;
}
