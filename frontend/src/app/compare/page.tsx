import type { Metadata } from 'next';
import CompareHubContent from './CompareHubContent';
import CompareHubJsonLd from './CompareHubJsonLd';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Compare DocTalk with ChatPDF, NotebookLM & More',
  description:
    'Compare DocTalk with ChatPDF, AskYourPDF, NotebookLM, Humata, and PDF.ai using feature tables, pricing breakdowns, and honest verdicts.',
  path: '/compare',
  localized: true,
  keywords: ['ai pdf tool comparison', 'chatpdf vs alternatives', 'document ai comparison'],
  openGraph: {
    title: 'AI Document Tool Comparisons | DocTalk',
  },
});

export default function CompareHubPage() {
  return (
    <>
      <CompareHubJsonLd locale="en" />
      <CompareHubContent locale="en" />
    </>
  );
}
