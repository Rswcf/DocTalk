import type { Metadata } from 'next';
import CitationsContent from './CitationsContent';
import CitationsJsonLd from './CitationsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Answers with Source Citations',
  description:
    'Every AI answer includes numbered citations. Click any citation to jump to the exact source text and verify every answer in your document.',
  path: '/features/citations',
  localized: true,
  keywords: ['citation highlighting', 'ai citation', 'document citation', 'source verification ai'],
  openGraph: {
    title: 'AI Answers with Source Citations | DocTalk',
    description:
      'Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in your document. Verify every answer.',
  },
});

export default function CitationsPage() {
  return (
    <>
      <CitationsJsonLd locale="en" />
      <CitationsContent locale="en" />
    </>
  );
}
