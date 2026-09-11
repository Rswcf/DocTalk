import type { Metadata } from 'next';
import FeaturesHubContent from './FeaturesHubContent';
import FeaturesHubJsonLd from './FeaturesHubJsonLd';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk Features: Citations, OCR & 11 Languages',
  description:
    'Explore DocTalk features for AI document analysis, including citation highlighting, multi-format uploads, OCR, multilingual support, and AI performance modes.',
  path: '/features',
  localized: true,
  keywords: ['ai document features', 'pdf chat features', 'document ai capabilities'],
  openGraph: {
    title: 'AI Document Analysis Features | DocTalk',
  },
});

export default function FeaturesPage() {
  return (
    <>
      <FeaturesHubJsonLd locale="en" />
      <FeaturesHubContent locale="en" />
    </>
  );
}
