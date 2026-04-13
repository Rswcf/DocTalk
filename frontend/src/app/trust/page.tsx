import type { Metadata } from 'next';
import TrustPageClient from './TrustPageClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Trust & Security at DocTalk',
  description:
    'How DocTalk secures your documents: AES-256 encryption at rest, SSRF protection, magic-byte validation, zero-retention LLM calls, GDPR data rights, and what we have not yet certified.',
  path: '/trust',
  openGraph: {
    title: 'Trust & Security | DocTalk',
    description: 'The real security and privacy controls in place for DocTalk.',
  },
});

export default function TrustPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Trust & Security' },
            ],
          }),
        }}
      />
      <TrustPageClient />
    </>
  );
}
