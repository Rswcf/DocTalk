import type { Metadata } from 'next';
import UseCasesHubClient from './UseCasesHubClient';

export const metadata: Metadata = {
  title: 'Use Cases | DocTalk',
  description:
    'See how students, lawyers, financial analysts, and HR teams use DocTalk to analyze documents with AI. Get cited answers for any industry.',
  alternates: { canonical: '/use-cases' },
  openGraph: {
    title: 'Use Cases | DocTalk',
    description:
      'See how students, lawyers, financial analysts, and HR teams use DocTalk to analyze documents with AI. Get cited answers for any industry.',
    url: 'https://www.doctalk.site/use-cases',
  },
};

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
