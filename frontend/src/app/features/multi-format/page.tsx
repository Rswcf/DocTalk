import type { Metadata } from 'next';
import MultiFormatContent from './MultiFormatContent';
import MultiFormatJsonLd from './MultiFormatJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Chat with PDF, DOCX, PPTX, XLSX & More',
  description:
    'Upload PDF, Word, PowerPoint, Excel, TXT, Markdown, or a URL. DocTalk reads your document and answers questions with cited sources. Try it free.',
  path: '/features/multi-format',
  localized: true,
  keywords: ['multi format document ai', 'pdf docx pptx ai', 'document converter chat'],
  openGraph: {
    title: 'Chat with PDF, DOCX, PPTX, XLSX & More | DocTalk',
    description:
      'Upload PDF, Word, PowerPoint, Excel, TXT, Markdown, or any URL. DocTalk\'s AI reads your document and answers questions with cited sources.',
  },
});

export default function MultiFormatPage() {
  return (
    <>
      <MultiFormatJsonLd locale="en" />
      <MultiFormatContent locale="en" />
    </>
  );
}
