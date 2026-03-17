import type { Metadata } from 'next';
import ReadingTimeClient from './ReadingTimeClient';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Reading Time Calculator - Estimate How Long to Read Any Text',
  description:
    'Calculate how long it takes to read or present any text. Compare reading speeds and speaking times for presentations. Free online tool.',
  path: '/tools/reading-time',
  keywords: [
    'reading time calculator',
    'how long to read',
    'reading time estimator',
    'speaking time calculator',
    'presentation time estimator',
    'words per minute calculator',
    'wpm calculator',
  ],
  openGraph: {
    title: 'Reading Time Calculator | DocTalk',
  },
});

export default function ReadingTimePage() {
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
              { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://www.doctalk.site/tools' },
              { '@type': 'ListItem', position: 3, name: 'Reading Time Calculator' },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DocTalk Reading Time Calculator',
            applicationCategory: 'UtilityApplication',
            operatingSystem: 'Web',
            url: 'https://www.doctalk.site/tools/reading-time',
            description:
              'Free reading time and speaking time calculator. Estimate how long it takes to read or present any text at different speeds.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }),
        }}
      />
      <ReadingTimeClient />
    </>
  );
}
