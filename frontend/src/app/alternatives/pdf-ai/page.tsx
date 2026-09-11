import type { Metadata } from 'next';
import PdfAiAltsContent from './PdfAiAltsContent';
import PdfAiAltsJsonLd from './PdfAiAltsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: '7 Best PDF.ai Alternatives in 2026 (Free & Paid)',
  description:
    'Looking for PDF.ai alternatives? Compare DocTalk, ChatPDF, AskYourPDF, Humata, NotebookLM, ChatDOC, and Sharly. Find the best AI document tool for your needs.',
  path: '/alternatives/pdf-ai',
  localized: true,
  keywords: ['pdf.ai alternative', 'pdf ai alternatives 2026', 'tools like pdf.ai'],
  openGraph: {
    title: '7 Best PDF.ai Alternatives in 2026 (Free & Paid) | DocTalk',
    description:
      'The top 7 PDF.ai alternatives ranked by features, pricing, and use case. Multi-format tools, citation systems, and free options.',
  },
});

export default function PdfAiAltsPage() {
  return (
    <>
      <PdfAiAltsJsonLd locale="en" />
      <PdfAiAltsContent locale="en" />
    </>
  );
}
