import type { Metadata } from 'next';
import ChatpdfAltsClient from './ChatpdfAltsClient';

export const metadata: Metadata = {
  title: '7 Best ChatPDF Alternatives in 2026 (Free & Paid)',
  description: 'Looking for ChatPDF alternatives? Compare DocTalk, AskYourPDF, Humata, NotebookLM, PDF.ai, ChatDOC, and Sharly. Find the best AI document tool for your needs.',
  alternates: { canonical: '/alternatives/chatpdf' },
  openGraph: {
    title: '7 Best ChatPDF Alternatives in 2026 (Free & Paid) | DocTalk',
    description: 'The top 7 ChatPDF alternatives ranked by features, pricing, and use case. Multi-format tools, citation systems, and free options.',
    url: 'https://www.doctalk.site/alternatives/chatpdf',
  },
};

const faqItems = [
  {
    question: 'What is the best free ChatPDF alternative?',
    answer: 'Google NotebookLM is the best completely free alternative, offering multi-source notebooks and audio podcast generation with no usage limits (Google account required). DocTalk also offers a free demo with no signup required and a free tier with 500 credits per month.',
  },
  {
    question: 'Which ChatPDF alternative supports the most file formats?',
    answer: 'DocTalk supports the widest range of document formats with 7 types: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. ChatPDF and most other alternatives only support PDF files.',
  },
  {
    question: 'Which alternative has the best citation system?',
    answer: 'DocTalk has the most advanced citation system with real-time visual highlighting. Click any citation to instantly scroll to and highlight the exact source passage in your document. Other tools only provide page number references.',
  },
  {
    question: 'Is there a ChatPDF alternative with team features?',
    answer: 'Humata offers the best team collaboration features with shared workspaces, role management, and a Team plan at $49/user/month. Most other alternatives, including DocTalk, focus on individual users.',
  },
  {
    question: 'Which ChatPDF alternative is best for academic research?',
    answer: 'AskYourPDF is best for researchers who need Zotero integration and API access. DocTalk is best for researchers who need citation verification with highlighting. NotebookLM is best for free multi-source literature reviews.',
  },
];

const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
  { position: 3, name: 'Humata', url: 'https://humata.ai' },
  { position: 4, name: 'NotebookLM', url: 'https://notebooklm.google.com' },
  { position: 5, name: 'PDF.ai', url: 'https://pdf.ai' },
  { position: 6, name: 'ChatDOC', url: 'https://chatdoc.com' },
  { position: 7, name: 'Sharly', url: 'https://sharly.ai' },
];

export default function ChatpdfAltsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: '7 Best ChatPDF Alternatives in 2026 (Free & Paid)',
            description: 'A comprehensive guide to the best ChatPDF alternatives for AI document analysis.',
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
              { '@type': 'ListItem', position: 3, name: 'ChatPDF Alternatives' },
            ],
          }),
        }}
      />
      <ChatpdfAltsClient />
    </>
  );
}
