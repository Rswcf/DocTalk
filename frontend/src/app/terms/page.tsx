import type { Metadata } from 'next';
import TermsPageClient from './TermsPageClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Terms of Service for DocTalk',
  description:
    'Read the DocTalk terms of service covering acceptable use, account responsibilities, intellectual property, and service limitations.',
  path: '/terms',
  openGraph: {
    title: 'Terms of Service | DocTalk',
    description: 'Rules and account terms for using the DocTalk AI document analysis platform.',
  },
});

export default function TermsPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Terms of Service' },
            ],
          }),
        }}
      />
      <TermsPageClient />
    </>
  );
}
