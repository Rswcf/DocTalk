import type { Metadata } from 'next';
import NotebooklmAltsContent from './NotebooklmAltsContent';
import NotebooklmAltsJsonLd from './NotebooklmAltsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Best NotebookLM Alternatives for Documents',
  description:
    'Compare NotebookLM alternatives including DocTalk, ChatPDF, AskYourPDF, Humata, Consensus, and Elicit for document analysis without Google lock-in.',
  path: '/alternatives/notebooklm',
  localized: true,
  keywords: ['notebooklm alternatives', 'best notebooklm alternative', 'google notebooklm replacement'],
  openGraph: {
    title: 'Best NotebookLM Alternatives for Documents | DocTalk',
    description:
      'Top NotebookLM alternatives for AI document analysis. Citation highlighting, multi-format support, and privacy-first options.',
  },
});

export default function NotebooklmAltsPage() {
  return (
    <>
      <NotebooklmAltsJsonLd locale="en" />
      <NotebooklmAltsContent locale="en" />
    </>
  );
}
