import type { Metadata } from 'next';
import { buildMarketingMetadata } from '../../lib/seo';
import PricingPageContent from './PricingPageContent';
import PricingJsonLd from './PricingJsonLd';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk Pricing for Free, Plus, and Pro',
  description:
    'See DocTalk pricing for Free, Plus, and Pro plans. Compare monthly credits, document limits, export features, OCR support, and AI modes.',
  path: '/pricing',
  localized: true,
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
      <PricingJsonLd locale="en" />
      <PricingPageContent locale="en" />
    </>
  );
}
