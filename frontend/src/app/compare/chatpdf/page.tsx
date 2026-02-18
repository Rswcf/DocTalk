import type { Metadata } from 'next';
import ChatpdfClient from './ChatpdfClient';

export const metadata: Metadata = {
  title: 'DocTalk vs ChatPDF: Full Comparison (2026)',
  description: 'Compare DocTalk and ChatPDF side by side. DocTalk supports 7 document formats with real-time citation highlighting, while ChatPDF is PDF-only. See features, pricing, and our honest verdict.',
  alternates: { canonical: '/compare/chatpdf' },
  openGraph: {
    title: 'DocTalk vs ChatPDF: Full Comparison (2026) | DocTalk',
    description: 'Feature-by-feature comparison of DocTalk and ChatPDF. Multi-format support, citation highlighting, pricing, and more.',
    url: 'https://www.doctalk.site/compare/chatpdf',
  },
};

const faqItems = [
  {
    question: 'Is DocTalk better than ChatPDF?',
    answer: 'DocTalk supports 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) while ChatPDF only supports PDF. DocTalk also provides real-time citation highlighting that shows you exactly where in the document each answer comes from, a feature ChatPDF lacks. However, ChatPDF has been around longer and has a larger user base.',
  },
  {
    question: 'Does ChatPDF have citation highlighting?',
    answer: 'ChatPDF mentions page numbers in its answers but does not offer inline citation highlighting. DocTalk provides real-time citation highlighting that visually highlights the exact passage in your document when you click a citation, making it much easier to verify AI answers.',
  },
  {
    question: 'Can I use DocTalk for free?',
    answer: 'Yes. DocTalk offers an instant demo that requires no signup at all, plus a free tier with 500 credits per month after you create an account. ChatPDF offers a free tier limited to 2 PDFs per day with 3 questions each.',
  },
  {
    question: 'Which tool supports more languages?',
    answer: 'DocTalk supports 11 interface languages (English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi) and can analyze documents in any language. ChatPDF is primarily English-focused with limited multilingual support.',
  },
  {
    question: 'Can DocTalk handle Word and PowerPoint files?',
    answer: 'Yes. DocTalk natively supports PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. ChatPDF only processes PDF files, so you would need to convert other formats to PDF first.',
  },
];

export default function CompareChatpdfPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'DocTalk vs ChatPDF: Full Comparison (2026)',
            description: 'A detailed feature-by-feature comparison of DocTalk and ChatPDF for AI document analysis.',
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
              { '@type': 'ListItem', position: 3, name: 'DocTalk vs ChatPDF' },
            ],
          }),
        }}
      />
      <ChatpdfClient />
    </>
  );
}
