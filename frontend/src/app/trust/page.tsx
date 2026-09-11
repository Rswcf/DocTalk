import type { Metadata } from 'next';
import TrustPageContent from './TrustPageContent';
import TrustJsonLd from './TrustJsonLd';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Trust & Security at DocTalk',
  description:
    'How DocTalk secures your documents: AES-256 encryption at rest, SSRF protection, magic-byte validation, zero-retention LLM calls, GDPR data rights, and what we have not yet certified.',
  path: '/trust',
  localized: true,
  openGraph: {
    title: 'Trust & Security | DocTalk',
    description: 'The real security and privacy controls in place for DocTalk.',
  },
});

export default function TrustPage() {
  return (
    <>
      <TrustJsonLd locale="en" />
      <TrustPageContent locale="en" />
    </>
  );
}
