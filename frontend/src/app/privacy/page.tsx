import type { Metadata } from 'next';
import PrivacyPageClient from './PrivacyPageClient';

export const metadata: Metadata = {
  title: 'Privacy Policy — DocTalk',
  description: 'Learn how DocTalk handles your data. Our privacy policy covers data collection, storage, your rights, and GDPR compliance.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}
