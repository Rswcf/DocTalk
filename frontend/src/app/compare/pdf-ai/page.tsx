import type { Metadata } from 'next';
import PdfaiClient from './PdfaiClient';

export const metadata: Metadata = {
  title: 'DocTalk vs PDF.ai: AI PDF Tool Comparison (2026)',
  description: 'Compare DocTalk and PDF.ai for AI document analysis. DocTalk supports 7 formats with citation highlighting. PDF.ai is PDF-only with a simpler approach. Full feature comparison.',
  alternates: { canonical: '/compare/pdf-ai' },
  openGraph: {
    title: 'DocTalk vs PDF.ai: AI PDF Tool Comparison (2026) | DocTalk',
    description: 'DocTalk vs PDF.ai: multi-format support, citation highlighting, and pricing compared.',
    url: 'https://www.doctalk.site/compare/pdf-ai',
  },
};

const faqItems = [
  {
    question: 'Is PDF.ai still active?',
    answer: 'PDF.ai continues to operate, but it has seen less development and growth compared to competitors. The tool focuses on basic PDF chat functionality without the advanced features that newer tools like DocTalk offer, such as citation highlighting and multi-format support.',
  },
  {
    question: 'Does PDF.ai support Word or Excel files?',
    answer: 'No. PDF.ai only supports PDF files. To analyze Word, PowerPoint, or Excel documents, you would need to convert them to PDF first. DocTalk natively supports 7 formats including DOCX, PPTX, and XLSX with dedicated parsers for each.',
  },
  {
    question: 'Which tool has better citations?',
    answer: 'DocTalk has significantly better citation support with real-time visual highlighting. When you click a citation, the document viewer scrolls to and highlights the exact source passage. PDF.ai provides basic page references without inline highlighting.',
  },
  {
    question: 'Is DocTalk more expensive than PDF.ai?',
    answer: 'DocTalk offers a free demo with no signup and a free tier with 500 credits per month. Paid plans start at $9.99/month. PDF.ai pricing varies, but DocTalk generally provides more features per dollar, including citation highlighting, 7 format support, and 11 languages.',
  },
];

export default function ComparePdfaiPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'DocTalk vs PDF.ai: AI PDF Tool Comparison (2026)',
            description: 'A comprehensive comparison of DocTalk and PDF.ai for AI-powered document analysis.',
            author: { '@type': 'Organization', name: 'DocTalk' },
            publisher: { '@type': 'Organization', name: 'DocTalk', url: 'https://www.doctalk.site' },
            datePublished: '2026-02-18',
            dateModified: '2026-02-18',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Compare', item: 'https://www.doctalk.site/compare' },
              { '@type': 'ListItem', position: 3, name: 'DocTalk vs PDF.ai' },
            ],
          }),
        }}
      />
      <PdfaiClient />
    </>
  );
}
