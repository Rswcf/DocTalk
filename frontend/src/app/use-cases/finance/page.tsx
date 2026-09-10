import type { Metadata } from 'next';
import FinanceContent from './FinanceContent';
import FinanceJsonLd from './FinanceJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI 10-K & Financial Report Analysis',
  description:
    'Analyze 10-K filings, financial statement footnotes, earnings reports, and SEC documents with AI. Get cited answers tied to exact figures and sections.',
  path: '/use-cases/finance',
  localized: true,
  keywords: [
    'ai for finance',
    'financial document ai',
    'annual report ai analysis',
    'ai 10-k analysis',
    'summarize financial statement footnotes',
    'sec filing ai analysis',
  ],
  openGraph: {
    title: 'AI 10-K & Financial Report Analysis | DocTalk',
    description:
      'Analyze 10-K filings, financial statement footnotes, earnings reports, and SEC documents with AI. Ask questions and get cited answers referencing exact source text.',
  },
});

export default function FinancePage() {
  return (
    <>
      <FinanceJsonLd locale="en" />
      <FinanceContent locale="en" />
    </>
  );
}
