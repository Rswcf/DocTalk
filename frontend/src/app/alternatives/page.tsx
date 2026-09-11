import type { Metadata } from 'next';
import AlternativesHubContent from './AlternativesHubContent';
import AlternativesHubJsonLd from './AlternativesHubJsonLd';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Best Alternatives to ChatPDF, NotebookLM, Humata & More',
  description:
    'Find the best alternatives to ChatPDF, NotebookLM, Humata, AskYourPDF, PDF.ai, and other AI document tools with comparisons on features, pricing, and best-fit use cases.',
  path: '/alternatives',
  localized: true,
  keywords: ['ai pdf alternatives', 'chatpdf alternatives', 'document ai tools'],
  openGraph: {
    title: 'AI Document Tool Alternatives | DocTalk',
  },
});

export default function AlternativesHubPage() {
  return (
    <>
      <AlternativesHubJsonLd locale="en" />
      <AlternativesHubContent locale="en" />
    </>
  );
}
