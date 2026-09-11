import type { Metadata } from 'next';
import NotebooklmContent from './NotebooklmContent';
import NotebooklmJsonLd from './NotebooklmJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk vs NotebookLM: Which AI Document Tool?',
  description:
    'Compare DocTalk and Google NotebookLM across citations, format support, privacy, pricing, and the tradeoff between deep analysis and multi-source notebooks.',
  path: '/compare/notebooklm',
  localized: true,
  keywords: ['doctalk vs notebooklm', 'notebooklm alternative', 'google notebooklm comparison'],
  openGraph: {
    title: 'DocTalk vs NotebookLM: Which AI Document Tool? | DocTalk',
    description:
      'DocTalk vs Google NotebookLM: citation highlighting, format support, privacy, and pricing compared.',
  },
});


export default function CompareNotebooklmPage() {
  return (
    <>
      <NotebooklmJsonLd locale="en" />
      <NotebooklmContent locale="en" />
    </>
  );
}
