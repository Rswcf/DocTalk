import type { Metadata } from 'next';
import HumataClient from './HumataClient';

export const metadata: Metadata = {
  title: 'DocTalk vs Humata: AI Document Tool Comparison',
  description: 'Compare DocTalk and Humata AI for document analysis. DocTalk offers citation highlighting and 11 languages at lower prices. Humata has team features and video support.',
  alternates: { canonical: '/compare/humata' },
  openGraph: {
    title: 'DocTalk vs Humata: AI Document Tool Comparison | DocTalk',
    description: 'DocTalk vs Humata: citation highlighting, language support, team features, and pricing compared side by side.',
    url: 'https://www.doctalk.site/compare/humata',
  },
};

const faqItems = [
  {
    question: 'Is DocTalk cheaper than Humata?',
    answer: 'Yes. DocTalk Plus costs $9.99/month with 3,000 credits, while Humata Student costs $4.99/month with only 100 pages/month, and Humata Expert costs $14.99/month. For most users, DocTalk provides better value per dollar with more generous usage limits and citation highlighting included at every tier.',
  },
  {
    question: 'Does Humata have citation highlighting?',
    answer: 'Humata provides page references in its answers but does not offer real-time inline citation highlighting. DocTalk lets you click any citation to instantly scroll to and highlight the exact passage in your document viewer.',
  },
  {
    question: 'Which tool is better for teams?',
    answer: 'Humata has an edge for team collaboration with shared workspaces and team management features on its Team plan ($49/user/month). DocTalk is currently focused on individual users, making it the better choice for personal document analysis.',
  },
  {
    question: 'Can Humata process video files?',
    answer: 'Yes, Humata supports video file analysis, which is a unique feature. DocTalk does not support video files but handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with real-time citation highlighting.',
  },
];

export default function CompareHumataPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'DocTalk vs Humata: AI Document Tool Comparison',
            description: 'A detailed comparison of DocTalk and Humata for AI document analysis, covering features, pricing, and use cases.',
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
              { '@type': 'ListItem', position: 3, name: 'DocTalk vs Humata' },
            ],
          }),
        }}
      />
      <HumataClient />
    </>
  );
}
