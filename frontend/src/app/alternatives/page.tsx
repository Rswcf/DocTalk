import type { Metadata } from 'next';
import AlternativesHubClient from './AlternativesHubClient';

export const metadata: Metadata = {
  title: 'AI Document Tool Alternatives',
  description: 'Find the best alternatives to ChatPDF, NotebookLM, Humata, and other AI document tools. Compare features, pricing, and find the right tool for your needs.',
  alternates: { canonical: '/alternatives' },
  openGraph: {
    title: 'AI Document Tool Alternatives | DocTalk',
    description: 'Explore alternatives to popular AI document tools. Comprehensive guides with features, pricing, and recommendations.',
    url: 'https://www.doctalk.site/alternatives',
  },
};

export default function AlternativesHubPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Alternatives' },
            ],
          }),
        }}
      />
      <AlternativesHubClient />
    </>
  );
}
