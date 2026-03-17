import type { Metadata } from 'next';
import AskyourpdfAltsClient from './AskyourpdfAltsClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: '7 Best AskYourPDF Alternatives in 2026 (Free & Paid)',
  description:
    'Looking for AskYourPDF alternatives? Compare DocTalk, ChatPDF, PDF.ai, Humata, NotebookLM, ChatDOC, and Consensus. Find the best AI document tool for your needs.',
  path: '/alternatives/askyourpdf',
  keywords: ['askyourpdf alternative', 'askyourpdf alternatives 2026', 'tools like askyourpdf'],
  openGraph: {
    title: '7 Best AskYourPDF Alternatives in 2026 (Free & Paid) | DocTalk',
    description:
      'The top 7 AskYourPDF alternatives ranked by features, pricing, and use case. Multi-format tools, citation systems, and free options.',
  },
});

const faqItems = [
  {
    question: 'What is the best free AskYourPDF alternative?',
    answer: 'Google NotebookLM is completely free with multi-source notebooks and audio summaries. DocTalk also offers a free demo with no signup and a free tier with 500 credits per month, making both strong options for users looking to switch from AskYourPDF without paying.',
  },
  {
    question: 'Why do people switch from AskYourPDF to other tools?',
    answer: 'Common reasons include limited file format support (AskYourPDF focuses mainly on PDFs), lack of real-time citation highlighting, inconsistent OCR quality on scanned documents, and pricing that can be high relative to features offered.',
  },
  {
    question: 'Which AskYourPDF alternative supports the most document formats?',
    answer: 'DocTalk supports 7 formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs), far more than AskYourPDF which primarily handles PDFs. This makes DocTalk ideal for users working with diverse document types.',
  },
  {
    question: 'Is there an AskYourPDF alternative with better citation accuracy?',
    answer: 'DocTalk offers the most advanced citation system with real-time visual highlighting that scrolls to and highlights the exact source passage. AskYourPDF provides page references but lacks the interactive visual verification that DocTalk offers.',
  },
  {
    question: 'Which AskYourPDF alternative is best for academic research?',
    answer: 'For academic research, Consensus is excellent for searching across published papers. DocTalk is best for analyzing specific documents with verifiable citations. NotebookLM is ideal for free multi-source literature reviews with audio summaries.',
  },
];

const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'ChatPDF', url: 'https://www.chatpdf.com' },
  { position: 3, name: 'PDF.ai', url: 'https://pdf.ai' },
  { position: 4, name: 'Humata', url: 'https://humata.ai' },
  { position: 5, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
  { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
  { position: 7, name: 'Consensus', url: 'https://consensus.app' },
];

export default function AskyourpdfAltsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: '7 Best AskYourPDF Alternatives in 2026 (Free & Paid)',
              description:
                'A comprehensive guide to the best AskYourPDF alternatives for AI document analysis.',
              path: '/alternatives/askyourpdf',
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
              { '@type': 'ListItem', position: 3, name: 'AskYourPDF Alternatives' },
            ],
          }),
        }}
      />
      <AskyourpdfAltsClient />
    </>
  );
}
