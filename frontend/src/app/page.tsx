import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';
import MarketingLocaleLinks from '../components/marketing/MarketingLocaleLinks';
import HomeJsonLd from './HomeJsonLd';
import { buildMarketingMetadata } from '../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: { absolute: 'DocTalk — AI Document Chat with Cited Answers' },
  description:
    'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more.',
  path: '/',
  localized: true,
  keywords: [
    'ai document chat',
    'chat with pdf',
    'ai pdf reader',
    'document analysis ai',
    'pdf question answering',
    'citation highlighting',
  ],
  openGraph: {
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
    type: 'website',
  },
  twitter: {
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
  },
});

export default function HomePage() {
  return (
    <>
      <HomeJsonLd locale="en" />
      <HomePageClient />
      <MarketingLocaleLinks path="/" />
    </>
  );
}
