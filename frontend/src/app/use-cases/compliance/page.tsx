import type { Metadata } from 'next';
import ComplianceClient from './ComplianceClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Compliance and Risk Teams',
  description:
    'Analyze regulations, internal policies, audit reports, and compliance frameworks with AI. Cross-reference documents and get cited answers.',
  path: '/use-cases/compliance',
  keywords: ['ai compliance document review', 'regulatory document analysis ai', 'compliance ai tool', 'risk document analysis'],
  openGraph: {
    title: 'AI Document Analysis for Compliance and Risk Teams | DocTalk',
    description:
      'Analyze regulations, policies, and audit reports with AI-powered cited answers. Cross-reference compliance documents. Try free.',
  },
});

const faqItems = [
  {
    question: 'Can DocTalk analyze regulatory documents?',
    answer:
      'Yes. Upload regulatory texts, guidelines, or standards as PDF or DOCX files and ask questions like "What are the data retention requirements?", "What penalties apply for non-compliance?", or "Summarize the reporting obligations." DocTalk extracts the relevant provisions with numbered citations to the exact section.',
  },
  {
    question: 'Does it support cross-document analysis?',
    answer:
      'Yes. Use Collections to group related documents — such as a regulation, your internal policy, and an audit report. Then ask questions that span all documents, like "Does our internal policy cover all requirements in the regulation?" The AI cites the specific document and passage for each point.',
  },
  {
    question: 'Can it analyze SEC filings and financial regulations?',
    answer:
      'Yes. DocTalk can analyze SEC filings (10-K, 10-Q, 8-K), banking regulations, insurance compliance documents, and other financial regulatory texts. Upload the document and ask specific questions about requirements, deadlines, or definitions. Each answer includes citations to the source text.',
  },
  {
    question: 'Is there an audit trail for compliance reviews?',
    answer:
      'DocTalk preserves the full conversation history for each document session, including all questions asked and answers with their citations. Plus and Pro plan users can export these conversations. This provides a record of what was reviewed and what the AI found, though it is not a formal audit system.',
  },
  {
    question: 'What pricing works for compliance teams?',
    answer:
      'DocTalk offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). The Pro plan includes Thorough analysis mode for complex regulatory documents and custom instructions for specialized compliance frameworks. Team plans are on the roadmap.',
  },
];

export default function CompliancePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: 'AI Document Analysis for Compliance and Risk Teams',
              description:
                'How compliance and risk teams use DocTalk to analyze regulations, policies, and audit reports with AI-powered cited answers.',
              path: '/use-cases/compliance',
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
              { '@type': 'ListItem', position: 3, name: 'Compliance & Risk' },
            ],
          }),
        }}
      />
      <ComplianceClient />
    </>
  );
}
