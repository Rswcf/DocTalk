import type { Metadata } from 'next';
import HealthcareContent from './HealthcareContent';
import HealthcareJsonLd from './HealthcareJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Healthcare Professionals',
  description:
    'Review clinical studies, compliance documents, protocols, and insurance policies with AI. Get cited answers from complex healthcare documents.',
  path: '/use-cases/healthcare',
  localized: true,
  keywords: ['ai for healthcare documents', 'medical document analysis ai', 'ai clinical document review', 'healthcare ai tool'],
  openGraph: {
    title: 'AI Document Analysis for Healthcare Professionals | DocTalk',
    description:
      'Review clinical research, compliance documents, and protocols with AI-powered cited answers. Accelerate healthcare document review. Try free.',
  },
});

export default function HealthcarePage() {
  return (
    <>
      <HealthcareJsonLd locale="en" />
      <HealthcareContent locale="en" />
    </>
  );
}
