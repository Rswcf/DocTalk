import type { Metadata } from 'next';
import FinanceClient from './FinanceClient';

export const metadata: Metadata = {
  title: 'AI Financial Report Analysis: 10-K, Earnings & SEC Filings | DocTalk',
  description:
    'Analyze 10-K filings, earnings reports, and financial documents with AI. Ask questions and get cited answers referencing specific figures. Try free.',
  alternates: { canonical: '/use-cases/finance' },
  openGraph: {
    title: 'AI Financial Report Analysis: 10-K, Earnings & SEC Filings | DocTalk',
    description:
      'Analyze 10-K filings, earnings reports, and financial documents with AI. Ask questions and get cited answers referencing specific figures. Try free.',
    url: 'https://www.doctalk.site/use-cases/finance',
  },
};

const faqItems = [
  {
    question: 'Can DocTalk extract financial data from 10-K filings?',
    answer:
      'Yes. Upload a 10-K filing as a PDF and ask questions like "What was the revenue for fiscal year 2025?" or "What are the main risk factors?" DocTalk extracts the relevant information with numbered citations pointing to the exact section of the filing where the data appears.',
  },
  {
    question: 'Does it support Excel spreadsheets?',
    answer:
      'Yes. DocTalk supports XLSX file uploads. You can upload financial models, budget spreadsheets, and data tables, then ask questions about the data. The AI processes the spreadsheet content and provides cited answers referencing specific cells and sheets.',
  },
  {
    question: 'How does DocTalk handle financial tables and numbers?',
    answer:
      'DocTalk extracts text from tables in PDF, DOCX, and XLSX documents and converts them to a structured format. When you ask about specific figures, the AI locates the relevant table and cites the exact location. For complex financial tables, uploading the original XLSX file often yields the best results.',
  },
  {
    question: 'Is the data secure?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your financial documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export and deletion capabilities.',
  },
  {
    question: 'Can I analyze earnings call transcripts?',
    answer:
      'Yes. Upload an earnings call transcript as a PDF, DOCX, or TXT file. Ask questions like "What guidance did management provide for Q4?" or "What did the CEO say about margins?" DocTalk extracts the relevant portions of the transcript with citations to the specific paragraphs.',
  },
];

export default function FinancePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'AI-Powered Financial Report Analysis with Cited Sources',
            description:
              'How financial analysts use DocTalk to analyze 10-K filings, earnings reports, and SEC documents with AI-powered cited answers.',
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
              { '@type': 'ListItem', position: 2, name: 'Use Cases', item: 'https://www.doctalk.site/use-cases' },
              { '@type': 'ListItem', position: 3, name: 'Financial Report Analysis' },
            ],
          }),
        }}
      />
      <FinanceClient />
    </>
  );
}
