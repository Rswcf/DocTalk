import type { Metadata } from 'next';
import { buildMarketingMetadata } from '../../lib/seo';
import ContactPageClient from './ContactPageClient';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Contact DocTalk Support',
  description:
    'Contact the DocTalk team for product support, billing questions, privacy requests, partnerships, bug reports, or general feedback.',
  path: '/contact',
  keywords: ['contact doctalk', 'doctalk support', 'document ai help'],
  openGraph: {
    title: 'Contact DocTalk',
  },
});

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            name: 'Contact DocTalk',
            description:
              'Contact information for the DocTalk team covering support, privacy, billing, and partnerships.',
            url: 'https://www.doctalk.site/contact',
            mainEntity: {
              '@type': 'Organization',
              name: 'DocTalk',
              url: 'https://www.doctalk.site',
              email: 'support@doctalk.site',
              logo: 'https://www.doctalk.site/logo-icon.png',
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Contact' },
            ],
          }),
        }}
      />
      <ContactPageClient />
    </>
  );
}
