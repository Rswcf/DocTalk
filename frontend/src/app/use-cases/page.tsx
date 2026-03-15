import type { Metadata } from 'next';
import UseCasesHubClient from './UseCasesHubClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis Use Cases for Students, Legal, Finance & HR',
  description:
    'See how students, lawyers, financial analysts, and HR teams use DocTalk to analyze documents with AI and verify answers with citations.',
  path: '/use-cases',
  openGraph: {
    title: 'AI Document Analysis Use Cases | DocTalk',
  },
});

export default function UseCasesPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Use Cases' },
            ],
          }),
        }}
      />
      <UseCasesHubClient />
    </>
  );
}
