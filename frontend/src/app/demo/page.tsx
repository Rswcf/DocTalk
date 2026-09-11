import type { Metadata } from 'next';
import DemoPageClient from './DemoPageClient';
import DemoJsonLd from './DemoJsonLd';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: { absolute: 'Try DocTalk Free — Interactive Demo' },
  description:
    'Try DocTalk without signing up. Chat with sample documents, click source citations, and experience AI document Q&A before uploading your own files.',
  path: '/demo',
  localized: true,
  keywords: ['doctalk demo', 'try ai pdf chat', 'free document ai demo'],
  openGraph: {
    title: 'Free AI Document Chat Demo | DocTalk',
  },
});

export default function DemoPage() {
  return (
    <>
      <DemoJsonLd locale="en" />
      <DemoPageClient />
    </>
  );
}
