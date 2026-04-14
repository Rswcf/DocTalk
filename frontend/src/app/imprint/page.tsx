import type { Metadata } from 'next';
import ImprintPageClient from './ImprintPageClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Impressum',
  description:
    'Legal imprint and contact information for DocTalk pursuant to § 5 DDG (German Digital Services Act).',
  path: '/imprint',
  openGraph: {
    title: 'Impressum | DocTalk',
    description: 'Legal imprint and contact information for DocTalk.',
  },
});

export default function ImprintPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Impressum' },
            ],
          }),
        }}
      />
      <ImprintPageClient />
    </>
  );
}
