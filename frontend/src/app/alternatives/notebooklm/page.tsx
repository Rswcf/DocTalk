import type { Metadata } from 'next';
import NotebooklmAltsClient from './NotebooklmAltsClient';

export const metadata: Metadata = {
  title: '6 Best NotebookLM Alternatives for Document Analysis (2026)',
  description: 'Looking for NotebookLM alternatives? Compare DocTalk, ChatPDF, AskYourPDF, Humata, Consensus, and Elicit. Find document AI tools without Google lock-in.',
  alternates: { canonical: '/alternatives/notebooklm' },
  openGraph: {
    title: '6 Best NotebookLM Alternatives for Document Analysis (2026) | DocTalk',
    description: 'Top NotebookLM alternatives for AI document analysis. Citation highlighting, multi-format support, and privacy-first options.',
    url: 'https://www.doctalk.site/alternatives/notebooklm',
  },
};

const faqItems = [
  {
    question: 'Why look for NotebookLM alternatives?',
    answer: 'Common reasons include: wanting to avoid Google vendor lock-in, needing support for formats NotebookLM lacks (DOCX, PPTX, XLSX), wanting citation highlighting for answer verification, needing a fully multilingual interface, or preferring a privacy-first platform that encrypts your documents.',
  },
  {
    question: 'Is there a free NotebookLM alternative?',
    answer: 'DocTalk offers a free demo with no signup required and a free tier with 500 credits per month. ChatPDF offers 2 free PDFs per day. However, no other tool matches NotebookLM fully free unlimited usage, since it is subsidized by Google.',
  },
  {
    question: 'Which NotebookLM alternative has the best citations?',
    answer: 'DocTalk has the most advanced citation system with real-time visual highlighting. Click any citation to scroll to and highlight the exact source passage. Other tools provide page references but not visual highlighting.',
  },
  {
    question: 'Can any alternative create audio podcasts like NotebookLM?',
    answer: 'No. NotebookLM AI-generated audio podcast feature is unique and not replicated by any alternative. If audio summaries are important to your workflow, NotebookLM remains the only option for that specific feature.',
  },
  {
    question: 'Which alternative is best for scientific papers?',
    answer: 'Consensus is specifically built for scientific research, searching across 200M+ academic papers. For analyzing your own documents, DocTalk provides citation highlighting and AskYourPDF integrates with Zotero for reference management.',
  },
];

const alternatives = [
  { position: 1, name: 'DocTalk', url: 'https://www.doctalk.site' },
  { position: 2, name: 'ChatPDF', url: 'https://chatpdf.com' },
  { position: 3, name: 'AskYourPDF', url: 'https://askyourpdf.com' },
  { position: 4, name: 'Humata', url: 'https://humata.ai' },
  { position: 5, name: 'Consensus', url: 'https://consensus.app' },
  { position: 6, name: 'Elicit', url: 'https://elicit.com' },
];

export default function NotebooklmAltsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: '6 Best NotebookLM Alternatives for Document Analysis (2026)',
            description: 'A comprehensive guide to the best NotebookLM alternatives for AI document analysis.',
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
              { '@type': 'ListItem', position: 3, name: 'NotebookLM Alternatives' },
            ],
          }),
        }}
      />
      <NotebooklmAltsClient />
    </>
  );
}
