import type { Metadata } from 'next';
import ComplianceContent from './ComplianceContent';
import ComplianceJsonLd from './ComplianceJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Compliance and Risk Teams',
  description:
    'Analyze regulations, internal policies, audit reports, and compliance frameworks with AI. Cross-reference documents and get cited answers.',
  path: '/use-cases/compliance',
  localized: true,
  keywords: ['ai compliance document review', 'regulatory document analysis ai', 'compliance ai tool', 'risk document analysis'],
  openGraph: {
    title: 'AI Document Analysis for Compliance and Risk Teams | DocTalk',
    description:
      'Analyze regulations, policies, and audit reports with AI-powered cited answers. Cross-reference compliance documents. Try free.',
  },
});

export default function CompliancePage() {
  return (
    <>
      <ComplianceJsonLd locale="en" />
      <ComplianceContent locale="en" />
    </>
  );
}
