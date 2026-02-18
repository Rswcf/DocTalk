import type { Metadata } from 'next';
import BillingPageClient from './BillingPageClient';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Choose your DocTalk plan. Free, Plus, and Pro tiers with AI document chat, source citations, and multi-format support.',
  alternates: { canonical: '/billing' },
  openGraph: {
    title: 'DocTalk Pricing — Free, Plus & Pro Plans',
    description: 'Choose a DocTalk plan. Free with 500 credits/month, Plus for power users, Pro for professionals. Cancel anytime.',
    url: 'https://www.doctalk.site/billing',
  },
};

export default function BillingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DocTalk',
            description: 'AI-powered document chat app with source citations. Upload PDF, DOCX, PPTX, XLSX and chat with AI.',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: 'https://www.doctalk.site',
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: '0',
              highPrice: '19.99',
              priceCurrency: 'USD',
              offerCount: 3,
              offers: [
                {
                  '@type': 'Offer',
                  name: 'Free',
                  price: '0',
                  priceCurrency: 'USD',
                  description: '500 credits per month, Quick and Balanced modes',
                },
                {
                  '@type': 'Offer',
                  name: 'Plus',
                  price: '9.99',
                  priceCurrency: 'USD',
                  description: '3,000 credits per month, all performance modes',
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price: '9.99',
                    priceCurrency: 'USD',
                    billingDuration: 'P1M',
                  },
                },
                {
                  '@type': 'Offer',
                  name: 'Pro',
                  price: '19.99',
                  priceCurrency: 'USD',
                  description: '9,000 credits per month, all modes plus custom instructions',
                  priceSpecification: {
                    '@type': 'UnitPriceSpecification',
                    price: '19.99',
                    priceCurrency: 'USD',
                    billingDuration: 'P1M',
                  },
                },
              ],
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
              { '@type': 'ListItem', position: 2, name: 'Pricing' },
            ],
          }),
        }}
      />
      <BillingPageClient />
    </>
  );
}
