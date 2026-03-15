import type { Metadata } from 'next';
import DemoPageClient from './DemoPageClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: { absolute: 'Try DocTalk Free — Interactive Demo' },
  description:
    'Try DocTalk without signing up. Chat with sample documents, click source citations, and experience AI document Q&A before uploading your own files.',
  path: '/demo',
  openGraph: {
    title: 'Free AI Document Chat Demo | DocTalk',
  },
});

export default function DemoPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Demo' },
            ],
          }),
        }}
      />
      <DemoPageClient />
    </>
  );
}
