import type { Metadata } from 'next';
import ConsultantsContent from './ConsultantsContent';
import ConsultantsJsonLd from './ConsultantsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Consultants and Advisors',
  description:
    'Analyze RFPs, market research reports, financial statements, and client documents with AI. Get cited answers to accelerate consulting workflows.',
  path: '/use-cases/consultants',
  localized: true,
  keywords: ['ai for consultants', 'consulting document analysis', 'ai report analysis', 'business document ai'],
  openGraph: {
    title: 'AI Document Analysis for Consultants and Advisors | DocTalk',
    description:
      'Analyze RFPs, market research, and client documents with AI-powered cited answers. Accelerate your consulting workflow. Try free.',
  },
});

export default function ConsultantsPage() {
  return (
    <>
      <ConsultantsJsonLd locale="en" />
      <ConsultantsContent locale="en" />
    </>
  );
}
