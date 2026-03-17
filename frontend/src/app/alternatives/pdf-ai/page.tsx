import type { Metadata } from 'next';
import PdfAiAltsClient from './PdfAiAltsClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: '7 Best PDF.ai Alternatives in 2026 (Free & Paid)',
  description:
    'Looking for PDF.ai alternatives? Compare DocTalk, ChatPDF, AskYourPDF, Humata, NotebookLM, ChatDOC, and Sharly. Find the best AI document tool for your needs.',
  path: '/alternatives/pdf-ai',
  keywords: ['pdf.ai alternative', 'pdf ai alternatives 2026', 'tools like pdf.ai'],
  openGraph: {
    title: '7 Best PDF.ai Alternatives in 2026 (Free & Paid) | DocTalk',
    description:
      'The top 7 PDF.ai alternatives ranked by features, pricing, and use case. Multi-format tools, citation systems, and free options.',
  },
});

const faqItems = [
  {
    question: 'What is the best free PDF.ai alternative?',
    answer: 'Google NotebookLM is the best completely free alternative, offering multi-source notebooks and audio podcast generation. DocTalk also offers a free demo with no signup and a free tier with 500 credits per month, both providing more features than PDF.ai\'s free plan.',
  },
  {
    question: 'Why do people switch from PDF.ai to other tools?',
    answer: 'Common reasons include PDF.ai\'s limited format support (PDF only), basic citation system without visual highlighting, fewer language options, and higher pricing compared to alternatives that offer more features for the same cost.',
  },
  {
    question: 'Which PDF.ai alternative handles the most file formats?',
    answer: 'DocTalk supports 7 formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs), making it the most versatile alternative. PDF.ai only handles PDFs, so users needing multi-format support often switch to DocTalk or Humata.',
  },
  {
    question: 'Is there a PDF.ai alternative with better citation verification?',
    answer: 'DocTalk provides the most advanced citation system with real-time visual highlighting. Click any citation to scroll to and highlight the exact source passage in your document, offering much stronger verification than PDF.ai\'s basic page references.',
  },
  {
    question: 'Which PDF.ai alternative is best for team collaboration?',
    answer: 'Humata offers the best team features with shared workspaces, role-based access, and a Team plan at $49/user/month. For individual users who want strong citation verification and multi-format support, DocTalk is the top choice.',
  },
];

const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'ChatPDF', url: 'https://www.chatpdf.com' },
  { position: 3, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
  { position: 4, name: 'Humata', url: 'https://humata.ai' },
  { position: 5, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
  { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
  { position: 7, name: 'Sharly', url: 'https://sharly.ai' },
];

export default function PdfAiAltsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: '7 Best PDF.ai Alternatives in 2026 (Free & Paid)',
              description:
                'A comprehensive guide to the best PDF.ai alternatives for AI document analysis.',
              path: '/alternatives/pdf-ai',
              datePublished: '2026-03-18',
            })
          ),
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
            '@type': 'ItemList',
            itemListElement: alternatives.map((alt) => ({
              '@type': 'ListItem',
              position: alt.position,
              name: alt.name,
              url: alt.url,
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
              { '@type': 'ListItem', position: 2, name: 'Alternatives', item: 'https://www.doctalk.site/alternatives' },
              { '@type': 'ListItem', position: 3, name: 'PDF.ai Alternatives' },
            ],
          }),
        }}
      />
      <PdfAiAltsClient />
    </>
  );
}
