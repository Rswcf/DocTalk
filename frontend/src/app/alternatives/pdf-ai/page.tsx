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


const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'ChatPDF', url: 'https://www.chatpdf.com' },
  { position: 3, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
  { position: 4, name: 'Humata', url: 'https://humata.ai' },
  { position: 5, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
  { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
  { position: 7, name: 'Sharly', url: 'https://sharly.ai' },
];

export default function PdfAiAltsPage() {
  return (
    <>
      <PdfAiAltsJsonLd locale="en" />
      <PdfAiAltsContent locale="en" />
    </>
  );
}
