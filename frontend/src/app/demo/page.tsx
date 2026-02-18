import type { Metadata } from 'next';
import DemoPageClient from './DemoPageClient';

export const metadata: Metadata = {
  title: { absolute: 'Try DocTalk Free — Interactive Demo' },
  description: 'Try DocTalk without signing up. Chat with sample documents and see AI-powered answers with real-time source citations.',
  alternates: { canonical: '/demo' },
  openGraph: {
    title: 'Try DocTalk Free — Interactive Demo',
    description: 'Try DocTalk without signing up. Chat with sample documents and see AI-powered answers with real-time source citations.',
    url: 'https://www.doctalk.site/demo',
  },
};

export default function DemoPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Demo' },
            ],
          }),
        }}
      />
      <DemoPageClient />
    </>
  );
}
