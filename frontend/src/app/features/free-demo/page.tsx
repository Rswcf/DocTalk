import type { Metadata } from 'next';
import FreeDemoContent from './FreeDemoContent';
import FreeDemoJsonLd from './FreeDemoJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Free AI Document Chat Demo',
  description:
    'Try AI document chat instantly with 3 sample files. No signup, no credit card, and citation highlighting included from the first question.',
  path: '/features/free-demo',
  localized: true,
  keywords: ['free ai pdf demo', 'try document ai free', 'no signup pdf chat'],
  openGraph: {
    title: 'Free AI Document Chat Demo | DocTalk',
    description:
      'Chat with AI about sample documents instantly. No account, no credit card, no signup. 3 demo documents ready to explore.',
  },
});

export default function FreeDemoPage() {
  return (
    <>
      <FreeDemoJsonLd locale="en" />
      <FreeDemoContent locale="en" />
    </>
  );
}
