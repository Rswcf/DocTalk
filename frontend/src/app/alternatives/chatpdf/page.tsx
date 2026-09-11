import type { Metadata } from 'next';
import ChatpdfAltsContent from './ChatpdfAltsContent';
import ChatpdfAltsJsonLd from './ChatpdfAltsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: '7 Best ChatPDF Alternatives in 2026 (Free & Paid)',
  description:
    'Looking for ChatPDF alternatives? Compare DocTalk, AskYourPDF, Humata, NotebookLM, PDF.ai, ChatDOC, and Sharly. Find the best AI document tool for your needs.',
  path: '/alternatives/chatpdf',
  localized: true,
  keywords: ['chatpdf alternatives', 'best chatpdf alternative', 'chatpdf replacement'],
  openGraph: {
    title: '7 Best ChatPDF Alternatives in 2026 (Free & Paid) | DocTalk',
    description:
      'The top 7 ChatPDF alternatives ranked by features, pricing, and use case. Multi-format tools, citation systems, and free options.',
  },
});


const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
  { position: 3, name: 'Humata', url: 'https://humata.ai' },
  { position: 4, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
  { position: 5, name: 'PDF.ai', url: 'https://pdf.ai' },
  { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
  { position: 7, name: 'Sharly', url: 'https://sharly.ai' },
];

export default function ChatpdfAltsPage() {
  return (
    <>
      <ChatpdfAltsJsonLd locale="en" />
      <ChatpdfAltsContent locale="en" />
    </>
  );
}
