import type { Metadata } from 'next';
import AlternativesHubClient from './AlternativesHubClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Best Alternatives to ChatPDF, NotebookLM, Humata & More',
  description:
    'Find the best alternatives to ChatPDF, NotebookLM, Humata, AskYourPDF, PDF.ai, and other AI document tools with comparisons on features, pricing, and best-fit use cases.',
  path: '/alternatives',
  keywords: ['ai pdf alternatives', 'chatpdf alternatives', 'document ai tools'],
  openGraph: {
    title: 'AI Document Tool Alternatives | DocTalk',
  },
});

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
