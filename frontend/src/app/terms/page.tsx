import type { Metadata } from 'next';
import TermsPageClient from './TermsPageClient';

export const metadata: Metadata = {
  title: 'Terms of Service — DocTalk',
  description: 'DocTalk terms of service. Read about acceptable use, intellectual property, limitations of liability, and account terms.',
  alternates: { canonical: '/terms' },
};

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
