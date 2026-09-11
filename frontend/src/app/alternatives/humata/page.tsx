import type { Metadata } from 'next';
import HumataAltsContent from './HumataAltsContent';
import HumataAltsJsonLd from './HumataAltsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: '5 Best Humata AI Alternatives in 2026',
  description:
    'Compare the best Humata alternatives, including DocTalk, ChatPDF, AskYourPDF, NotebookLM, and PDF.ai, for pricing, citations, and language support.',
  path: '/alternatives/humata',
  localized: true,
  keywords: ['humata alternatives', 'best humata alternative', 'humata ai replacement'],
  openGraph: {
    title: '5 Best Humata AI Alternatives in 2026 | DocTalk',
    description:
      'Top Humata alternatives ranked by features, pricing, and use case. Citation highlighting, multi-format support, and free options.',
  },
});

export default function HumataAltsPage() {
  return (
    <>
      <HumataAltsJsonLd locale="en" />
      <HumataAltsContent locale="en" />
    </>
  );
}
