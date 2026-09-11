import type { Metadata } from 'next';
import ChatpdfContent from './ChatpdfContent';
import ChatpdfJsonLd from './ChatpdfJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'DocTalk vs ChatPDF: Full Comparison (2026)',
  description:
    'Compare DocTalk and ChatPDF for AI document analysis. See citation quality, format support, pricing, and which tool fits your workflow.',
  path: '/compare/chatpdf',
  localized: true,
  keywords: ['doctalk vs chatpdf', 'chatpdf alternative', 'chatpdf comparison'],
  openGraph: {
    title: 'DocTalk vs ChatPDF: Full Comparison (2026) | DocTalk',
    description:
      'Feature-by-feature comparison of DocTalk and ChatPDF. Multi-format support, citation highlighting, pricing, and more.',
  },
});


export default function CompareChatpdfPage() {
  return (
    <>
      <ChatpdfJsonLd locale="en" />
      <ChatpdfContent locale="en" />
    </>
  );
}
