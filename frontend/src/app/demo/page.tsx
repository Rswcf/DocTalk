import type { Metadata } from 'next';
import DemoPageClient from './DemoPageClient';

export const metadata: Metadata = {
  title: 'Try DocTalk Free — Interactive Demo',
  description: 'Try DocTalk without signing up. Chat with sample documents and see AI-powered answers with real-time source citations.',
  alternates: { canonical: '/demo' },
};

export default function DemoPage() {
  return <DemoPageClient />;
}
