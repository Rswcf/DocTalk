import type { Metadata } from 'next';
import { absoluteUrl, buildMarketingMetadata } from '../../lib/seo';
import PricingPageClient from './PricingPageClient';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk Pricing for Free, Plus, and Pro',
  description:
    'See DocTalk pricing for Free, Plus, and Pro plans. Compare monthly credits, document limits, export features, OCR support, and AI modes.',
  path: '/pricing',
  keywords: [
    'doctalk pricing',
    'ai pdf chat pricing',
    'document ai pricing',
    'chat with pdf pricing',
  ],
  openGraph: {
    title: 'DocTalk Pricing',
  },
});

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
              { '@type': 'ListItem', position: 2, name: 'Pricing', item: absoluteUrl('/pricing') },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How do DocTalk credits work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Credits measure usage across document parsing and AI chat. Free accounts receive 500 credits per month, Plus includes 3,000 credits, and Pro includes 9,000 credits.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which plans include all AI modes?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Plus and Pro include Quick, Balanced, and Thorough modes. Free includes Quick and Balanced.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I try DocTalk before paying?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. There is a free plan and a public demo so you can test the product before upgrading.',
                },
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DocTalk',
            applicationCategory: 'ProductivityApplication',
            operatingSystem: 'Web',
            url: absoluteUrl('/pricing'),
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'USD',
              lowPrice: '0',
              highPrice: '19.99',
              offerCount: 3,
              offers: [
                {
                  '@type': 'Offer',
                  name: 'Free',
                  price: '0',
                  priceCurrency: 'USD',
                  description: '500 credits/month, 3 documents, Quick & Balanced AI modes',
                },
                {
                  '@type': 'Offer',
                  name: 'Plus',
                  price: '9.99',
                  priceCurrency: 'USD',
                  description: '3,000 credits/month, unlimited documents, all AI modes including Thorough',
                },
                {
                  '@type': 'Offer',
                  name: 'Pro',
                  price: '19.99',
                  priceCurrency: 'USD',
                  description: '9,000 credits/month, unlimited documents, custom instructions, priority support',
                },
              ],
            },
          }),
        }}
      />
      <PricingPageClient />
    </>
  );
}
