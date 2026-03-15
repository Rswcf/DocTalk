import type { Metadata } from 'next';
import PrivacyPageClient from './PrivacyPageClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Privacy Policy for DocTalk',
  description:
    'Learn how DocTalk handles your data, storage, deletion rights, and GDPR-aligned privacy controls for uploaded documents.',
  path: '/privacy',
  openGraph: {
    title: 'Privacy Policy | DocTalk',
    description: 'How DocTalk handles your data, encryption, and document privacy controls.',
  },
});

export default function PrivacyPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Privacy Policy' },
            ],
          }),
        }}
      />
      <PrivacyPageClient />
    </>
  );
}
