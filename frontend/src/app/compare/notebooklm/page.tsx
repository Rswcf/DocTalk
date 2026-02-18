import type { Metadata } from 'next';
import NotebooklmClient from './NotebooklmClient';

export const metadata: Metadata = {
  title: 'DocTalk vs NotebookLM: Which AI Document Tool?',
  description: 'Compare DocTalk and Google NotebookLM. DocTalk offers citation highlighting, 7 formats, and 11 languages with no vendor lock-in. NotebookLM is free with audio podcasts but Google-only.',
  alternates: { canonical: '/compare/notebooklm' },
  openGraph: {
    title: 'DocTalk vs NotebookLM: Which AI Document Tool? | DocTalk',
    description: 'DocTalk vs Google NotebookLM: citation highlighting, format support, privacy, and pricing compared.',
    url: 'https://www.doctalk.site/compare/notebooklm',
  },
};

const faqItems = [
  {
    question: 'Is DocTalk better than NotebookLM?',
    answer: 'DocTalk and NotebookLM serve different purposes. DocTalk excels at single-document deep analysis with real-time citation highlighting, 7 format support, and 11 languages. NotebookLM is better for multi-source notebooks and offers unique AI-generated audio podcasts. DocTalk is the better choice if you need citation verification and format flexibility; NotebookLM is better for free multi-source research.',
  },
  {
    question: 'Is NotebookLM really free?',
    answer: 'Yes, Google NotebookLM is currently free to use, though it requires a Google account. Google has not yet announced pricing for future premium features. However, being free means you are subject to Google data practices and potential changes in service terms.',
  },
  {
    question: 'Does NotebookLM support citation highlighting?',
    answer: 'NotebookLM shows inline citations that link to the source document within the notebook. However, it does not provide the real-time visual highlighting that DocTalk offers, where clicking a citation scrolls to and highlights the exact passage in a document viewer alongside the chat.',
  },
  {
    question: 'Can I use DocTalk without a Google account?',
    answer: 'Yes. DocTalk supports Google OAuth, Microsoft OAuth, and email magic links for authentication. You can also use the instant demo with no account at all. NotebookLM requires a Google account, which may be a concern for users who prefer not to use Google services.',
  },
  {
    question: 'Which tool is more private?',
    answer: 'DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.',
  },
];

export default function CompareNotebooklmPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'DocTalk vs NotebookLM: Which AI Document Tool?',
            description: 'A comprehensive comparison of DocTalk and Google NotebookLM for AI document analysis.',
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
              { '@type': 'ListItem', position: 3, name: 'DocTalk vs NotebookLM' },
            ],
          }),
        }}
      />
      <NotebooklmClient />
    </>
  );
}
