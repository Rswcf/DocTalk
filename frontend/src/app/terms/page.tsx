import type { Metadata } from 'next';
import TermsPageClient from './TermsPageClient';

export const metadata: Metadata = {
  title: 'Terms of Service — DocTalk',
  description: 'DocTalk terms of service. Read about acceptable use, intellectual property, limitations of liability, and account terms.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <TermsPageClient />;
}
