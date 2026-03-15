import type { Metadata } from 'next';
import BillingPageClient from './BillingPageClient';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk Billing',
  description:
    'Manage your DocTalk plan, credits, and subscription settings.',
  path: '/billing',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'DocTalk Billing',
    description: 'Manage your DocTalk plan, credits, and subscription settings.',
  },
  twitter: {
    title: 'DocTalk Billing',
    description: 'Manage your DocTalk plan, credits, and subscription settings.',
  },
});

export default function BillingPage() {
  return <BillingPageClient />;
}
