import type { Metadata } from 'next';
import BillingPageClient from './BillingPageClient';

export const metadata: Metadata = {
  title: 'Pricing — DocTalk',
  description: 'Choose your DocTalk plan. Free, Plus, and Pro tiers with AI document chat, source citations, and multi-format support.',
  alternates: { canonical: '/billing' },
};

export default function BillingPage() {
  return <BillingPageClient />;
}
