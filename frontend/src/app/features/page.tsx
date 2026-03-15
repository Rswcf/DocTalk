import type { Metadata } from 'next';
import FeaturesHubClient from './FeaturesHubClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk Features: Citations, OCR & 11 Languages',
  description:
    'Explore DocTalk features for AI document analysis, including citation highlighting, multi-format uploads, OCR, multilingual support, and AI performance modes.',
  path: '/features',
  openGraph: {
    title: 'AI Document Analysis Features | DocTalk',
  },
});

export default function FeaturesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Features' },
            ],
          }),
        }}
      />
      <FeaturesHubClient />
    </>
  );
}
