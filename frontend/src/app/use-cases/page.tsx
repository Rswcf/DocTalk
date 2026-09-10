import type { Metadata } from 'next';
import UseCasesHubContent from './UseCasesHubContent';
import UseCasesHubJsonLd from './UseCasesHubJsonLd';
import { buildMarketingMetadata } from '../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Use Cases for Students, Legal, Finance & HR',
  description:
    'See how students, lawyers, financial analysts, and HR teams use DocTalk to analyze documents with AI and verify answers with citations.',
  path: '/use-cases',
  localized: true,
  keywords: ['ai document use cases', 'pdf ai for business', 'document chat applications'],
  openGraph: {
    title: 'AI Document Analysis Use Cases | DocTalk',
  },
});

export default function UseCasesPage() {
  return (
    <>
      <UseCasesHubJsonLd locale="en" />
      <UseCasesHubContent locale="en" />
    </>
  );
}
