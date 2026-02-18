import type { Metadata } from 'next';
import LawyersClient from './LawyersClient';

export const metadata: Metadata = {
  title: 'AI Legal Document Analysis: Contracts, Filings & More | DocTalk',
  description:
    'Review contracts, court filings, and legal documents with AI. Get cited answers with exact clause references. Secure, private, and GDPR-compliant. Try free.',
  alternates: { canonical: '/use-cases/lawyers' },
  openGraph: {
    title: 'AI Legal Document Analysis: Contracts, Filings & More | DocTalk',
    description:
      'Review contracts, court filings, and legal documents with AI. Get cited answers with exact clause references. Secure, private, and GDPR-compliant. Try free.',
    url: 'https://www.doctalk.site/use-cases/lawyers',
  },
};

const faqItems = [
  {
    question: 'Is DocTalk secure for confidential legal documents?',
    answer:
      'Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements. All data processing happens through secured API connections.',
  },
  {
    question: 'Can it analyze contracts?',
    answer:
      'Yes. DocTalk can analyze contracts in PDF, DOCX, and other formats. You can ask questions like "Find all indemnification clauses," "What are the termination conditions?", or "Summarize the liability provisions." Each answer includes numbered citations that link to the exact clause in the document.',
  },
  {
    question: 'How accurate is AI for legal analysis?',
    answer:
      'DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. It does not rely on general legal knowledge or training data. Every answer includes numbered citations so you can verify each claim against the source text. DocTalk is a research acceleration tool, not a substitute for legal judgment.',
  },
  {
    question: 'Does it work with scanned PDFs?',
    answer:
      'DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents, including contracts, filings, and memos generated from Word processors, produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction capability.',
  },
  {
    question: 'Is there a team plan?',
    answer:
      'DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). The Pro plan includes advanced features like Thorough analysis mode and custom instructions. Team and enterprise plans are on the roadmap.',
  },
];

export default function LawyersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'AI-Powered Legal Document Analysis with Verifiable Citations',
            description:
              'How legal professionals use DocTalk to review contracts, court filings, and regulatory documents with AI-powered cited answers.',
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
              { '@type': 'ListItem', position: 3, name: 'Legal Document Analysis' },
            ],
          }),
        }}
      />
      <LawyersClient />
    </>
  );
}
