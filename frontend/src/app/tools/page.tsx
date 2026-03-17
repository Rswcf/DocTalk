import type { Metadata } from 'next';
import ToolsHubClient from './ToolsHubClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Free AI Document Tools',
  description:
    'Free online document tools: word counter, reading time calculator, and more. No sign-up required. Powered by DocTalk.',
  path: '/tools',
  keywords: [
    'free document tools',
    'free pdf tools online',
    'ai document utilities',
    'online text tools',
    'document analysis tools free',
  ],
  openGraph: {
    title: 'Free AI Document Tools | DocTalk',
  },
});

export default function ToolsHubPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Tools' },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Free AI Document Tools',
            description:
              'Free online document utilities including word counter, reading time calculator, and more.',
            url: 'https://www.doctalk.site/tools',
            isPartOf: {
              '@type': 'WebSite',
              name: 'DocTalk',
              url: 'https://www.doctalk.site',
            },
          }),
        }}
      />
      <ToolsHubClient />
    </>
  );
}
