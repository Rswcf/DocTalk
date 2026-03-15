import type { Metadata } from 'next';
import CompareHubClient from './CompareHubClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Tool Comparisons: ChatPDF, NotebookLM, Humata & More',
  description:
    'Compare DocTalk with ChatPDF, AskYourPDF, NotebookLM, Humata, PDF.ai, and other document AI tools using feature tables, pricing, and verdicts.',
  path: '/compare',
  openGraph: {
    title: 'AI Document Tool Comparisons | DocTalk',
  },
});

export default function CompareHubPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Compare' },
            ],
          }),
        }}
      />
      <CompareHubClient />
    </>
  );
}
