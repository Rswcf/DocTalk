import type { Metadata } from 'next';
import FeaturesHubClient from './FeaturesHubClient';

export const metadata: Metadata = {
  title: 'Features | DocTalk',
  description: 'Explore DocTalk\'s AI document analysis features: citation highlighting, multi-format support, 11 languages, free demo, and 3 performance modes.',
  alternates: { canonical: '/features' },
  openGraph: {
    title: 'Features | DocTalk',
    description: 'Explore DocTalk\'s AI document analysis features: citation highlighting, multi-format support, 11 languages, free demo, and 3 performance modes.',
    url: 'https://www.doctalk.site/features',
  },
};

export default function FeaturesPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Features' },
            ],
          }),
        }}
      />
      <FeaturesHubClient />
    </>
  );
}
