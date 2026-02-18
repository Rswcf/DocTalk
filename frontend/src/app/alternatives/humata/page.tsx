import type { Metadata } from 'next';
import HumataAltsClient from './HumataAltsClient';

export const metadata: Metadata = {
  title: '5 Best Humata AI Alternatives in 2026',
  description: 'Looking for Humata alternatives? Compare DocTalk, ChatPDF, AskYourPDF, NotebookLM, and PDF.ai. Find AI document tools with better pricing, citations, and language support.',
  alternates: { canonical: '/alternatives/humata' },
  openGraph: {
    title: '5 Best Humata AI Alternatives in 2026 | DocTalk',
    description: 'Top Humata alternatives ranked by features, pricing, and use case. Citation highlighting, multi-format support, and free options.',
    url: 'https://www.doctalk.site/alternatives/humata',
  },
};

const faqItems = [
  {
    question: 'What is the best Humata alternative for individual users?',
    answer: 'DocTalk is the best Humata alternative for individual users. It offers citation highlighting, 7 document formats, 11 interface languages, and better value pricing ($9.99/month for 3,000 credits vs Humata Expert at $14.99/month for 500 pages).',
  },
  {
    question: 'Is there a free Humata alternative?',
    answer: 'Google NotebookLM is completely free with a Google account. DocTalk offers a free demo with no signup required and a free tier with 500 credits per month. ChatPDF offers 2 free PDFs per day.',
  },
  {
    question: 'Which Humata alternative has team features?',
    answer: 'Most Humata alternatives focus on individual users. If you need team collaboration, Humata Team plan ($49/user/month) remains the strongest option. However, AskYourPDF offers some collaboration features through its API and Chrome extension that teams can share.',
  },
  {
    question: 'Which alternative supports the most file formats?',
    answer: 'DocTalk supports the most formats with 7 types: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Humata supports PDF, Word, and video. ChatPDF and PDF.ai support only PDF.',
  },
  {
    question: 'Can any Humata alternative handle video files?',
    answer: 'No. Humata video file support is unique among AI document tools. If video analysis is essential, Humata remains the best choice. For document-only workflows, DocTalk 7-format support covers more document types.',
  },
];

const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'ChatPDF', url: 'https://chatpdf.com' },
  { position: 3, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
  { position: 4, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
  { position: 5, name: 'PDF.ai', url: 'https://pdf.ai' },
];

export default function HumataAltsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: '5 Best Humata AI Alternatives in 2026',
            description: 'A comprehensive guide to the best Humata AI alternatives for document analysis.',
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
              { '@type': 'ListItem', position: 3, name: 'Humata Alternatives' },
            ],
          }),
        }}
      />
      <HumataAltsClient />
    </>
  );
}
