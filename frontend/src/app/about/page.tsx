import type { Metadata } from 'next';
import { buildMarketingMetadata } from '../../lib/seo';
import AboutPageClient from './AboutPageClient';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'About DocTalk: Verified AI Document Chat',
  description:
    'Learn what DocTalk does, who it is for, how it approaches trustworthy AI document analysis, and how to contact the team.',
  path: '/about',
  openGraph: {
    title: 'About DocTalk',
  },
});

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: 'About DocTalk',
            description:
              'Background on DocTalk, its product mission, and its approach to trustworthy AI document analysis.',
            url: 'https://www.doctalk.site/about',
            mainEntity: {
              '@type': 'Organization',
              name: 'DocTalk',
              url: 'https://www.doctalk.site',
              logo: 'https://www.doctalk.site/logo-icon.png',
              sameAs: ['https://github.com/Rswcf/DocTalk'],
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'support@doctalk.site',
                contactType: 'customer support',
              },
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
              { '@type': 'ListItem', position: 2, name: 'About' },
            ],
          }),
        }}
      />
      <AboutPageClient />
    </>
  );
}
