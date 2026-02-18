import type { Metadata } from 'next';
import CompareHubClient from './CompareHubClient';

export const metadata: Metadata = {
  title: 'AI Document Tool Comparisons',
  description: 'Compare DocTalk with ChatPDF, AskYourPDF, NotebookLM, Humata, PDF.ai, and more. See feature-by-feature breakdowns, pricing, and honest verdicts.',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: 'AI Document Tool Comparisons | DocTalk',
    description: 'Compare DocTalk with popular AI document tools. Feature tables, pricing, and detailed analysis.',
    url: 'https://www.doctalk.site/compare',
  },
};

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
