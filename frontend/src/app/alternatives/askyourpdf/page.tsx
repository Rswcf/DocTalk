import type { Metadata } from 'next';
import AskyourpdfAltsContent from './AskyourpdfAltsContent';
import AskyourpdfAltsJsonLd from './AskyourpdfAltsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: '7 Best AskYourPDF Alternatives in 2026 (Free & Paid)',
  description:
    'Looking for AskYourPDF alternatives? Compare DocTalk, ChatPDF, PDF.ai, Humata, NotebookLM, ChatDOC, and Consensus. Find the best AI document tool for your needs.',
  path: '/alternatives/askyourpdf',
  localized: true,
  keywords: ['askyourpdf alternative', 'askyourpdf alternatives 2026', 'tools like askyourpdf'],
  openGraph: {
    title: '7 Best AskYourPDF Alternatives in 2026 (Free & Paid) | DocTalk',
    description:
      'The top 7 AskYourPDF alternatives ranked by features, pricing, and use case. Multi-format tools, citation systems, and free options.',
  },
});

export default function AskyourpdfAltsPage() {
  return (
    <>
      <AskyourpdfAltsJsonLd locale="en" />
      <AskyourpdfAltsContent locale="en" />
    </>
  );
}
