import type { Metadata } from 'next';
import PdfaiContent from './PdfaiContent';
import PdfaiJsonLd from './PdfaiJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk vs PDF.ai: AI PDF Tool Comparison (2026)',
  description:
    'Compare DocTalk and PDF.ai across citation quality, format support, pricing, and which tool is better for modern document analysis.',
  path: '/compare/pdf-ai',
  localized: true,
  keywords: ['doctalk vs pdf ai', 'pdf ai alternative', 'pdf.ai comparison'],
  openGraph: {
    title: 'DocTalk vs PDF.ai: AI PDF Tool Comparison (2026) | DocTalk',
    description:
      'DocTalk vs PDF.ai: multi-format support, citation highlighting, and pricing compared.',
  },
});


export default function ComparePdfaiPage() {
  return (
    <>
      <PdfaiJsonLd locale="en" />
      <PdfaiContent locale="en" />
    </>
  );
}
