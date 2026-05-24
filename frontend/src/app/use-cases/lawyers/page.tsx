import type { Metadata } from 'next';
import LawyersContent from './LawyersContent';
import LawyersJsonLd from './LawyersJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Legal Document Analysis',
  description:
    'Review contracts, court filings, and legal documents with AI. Get cited answers with exact clause references and verify every result.',
  path: '/use-cases/lawyers',
  localized: true,
  keywords: ['ai for lawyers', 'legal document ai', 'contract analysis ai', 'legal pdf reader'],
  openGraph: {
    title: 'AI Legal Document Analysis | DocTalk',
    description:
      'Review contracts, court filings, and legal documents with AI. Get cited answers with exact clause references. Secure, private, and GDPR-compliant. Try free.',
  },
});

export default function LawyersPage() {
  return (
    <>
      <LawyersJsonLd locale="en" />
      <LawyersContent locale="en" />
    </>
  );
}
