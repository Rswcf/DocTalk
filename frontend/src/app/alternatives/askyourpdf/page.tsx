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


const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'ChatPDF', url: 'https://www.chatpdf.com' },
  { position: 3, name: 'PDF.ai', url: 'https://pdf.ai' },
  { position: 4, name: 'Humata', url: 'https://humata.ai' },
  { position: 5, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
  { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
  { position: 7, name: 'Consensus', url: 'https://consensus.app' },
];

export default function AskyourpdfAltsPage() {
  return (
    <>
      <AskyourpdfAltsJsonLd locale="en" />
      <AskyourpdfAltsContent locale="en" />
    </>
  );
}
