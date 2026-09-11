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

export default function ChatpdfAltsPage() {
  return (
    <>
      <ChatpdfAltsJsonLd locale="en" />
      <ChatpdfAltsContent locale="en" />
    </>
  );
}
