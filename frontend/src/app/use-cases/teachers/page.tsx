import type { Metadata } from 'next';
import TeachersClient from './TeachersClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Teachers and Educators',
  description:
    'Help teachers review lesson plans, research papers, curriculum guides, and student submissions with AI. Get cited answers from any uploaded document.',
  path: '/use-cases/teachers',
  keywords: ['ai for teachers', 'teacher document analysis', 'ai grading tool', 'education ai tool'],
  openGraph: {
    title: 'AI Document Analysis for Teachers and Educators | DocTalk',
    description:
      'Review lesson plans, research papers, and student submissions with AI-powered cited answers. Save hours on document review. Try free.',
  },
});

const faqItems = [
  {
    question: 'Can DocTalk help grade papers?',
    answer:
      'DocTalk can help you review essay drafts and student submissions by extracting key arguments, identifying structure, and finding relevant passages. It provides cited references to the exact paragraphs in student work. However, DocTalk is a document analysis tool — final grading decisions and pedagogical judgment remain with you as the educator.',
  },
  {
    question: 'Does it work with educational PDFs and documents?',
    answer:
      'Yes. DocTalk supports PDF, DOCX, PPTX, XLSX, TXT, and Markdown files. You can upload textbooks, curriculum guides, lesson plans, research papers, and any educational document. The AI reads the full document and provides answers with numbered citations pointing to the exact source text.',
  },
  {
    question: 'Is student data kept private?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any uploaded document at any time. We recommend removing student names from submissions if privacy is a concern.',
  },
  {
    question: 'Can it integrate with my LMS (Canvas, Google Classroom)?',
    answer:
      'DocTalk does not currently integrate directly with LMS platforms like Canvas, Google Classroom, or Blackboard. You can download documents from your LMS and upload them to DocTalk for analysis. LMS integrations are on our roadmap for future development.',
  },
  {
    question: 'Is there a free plan for educators?',
    answer:
      'DocTalk offers a Free plan with 500 credits per month, which is a great starting point for trying the tool. For heavier use, the Plus plan ($9.99/month) provides 3,000 credits, and the Pro plan ($19.99/month) includes 9,000 credits with advanced features like Thorough analysis mode and custom instructions.',
  },
];

export default function TeachersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: 'AI Document Analysis for Teachers and Educators',
              description:
                'How teachers and educators use DocTalk to review lesson plans, research papers, and student submissions with AI-powered cited answers.',
              path: '/use-cases/teachers',
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
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Use Cases', item: 'https://www.doctalk.site/use-cases' },
              { '@type': 'ListItem', position: 3, name: 'Teachers & Educators' },
            ],
          }),
        }}
      />
      <TeachersClient />
    </>
  );
}
