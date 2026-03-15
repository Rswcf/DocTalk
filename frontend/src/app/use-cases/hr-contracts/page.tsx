import type { Metadata } from 'next';
import HrContractsClient from './HrContractsClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Contract & HR Document Review Tool',
  description:
    'Review employment contracts, HR policies, and company handbooks with AI. Get instant answers about specific clauses with source citations.',
  path: '/use-cases/hr-contracts',
  openGraph: {
    title: 'AI Contract & HR Document Review Tool | DocTalk',
    description:
      'Review employment contracts, HR policies, and company handbooks with AI. Get instant answers about specific clauses with source citations. Try free.',
  },
});

const faqItems = [
  {
    question: 'Can DocTalk analyze employment contracts?',
    answer:
      'Yes. Upload an employment contract in PDF or DOCX format and ask questions like "What is the non-compete clause?" or "What are the termination conditions?" DocTalk returns answers with numbered citations pointing to the exact clauses in the contract.',
  },
  {
    question: 'Is it secure for sensitive HR documents?',
    answer:
      'Yes. DocTalk encrypts all uploaded documents with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant and supports data export and deletion requests.',
  },
  {
    question: 'Can employees use it to understand their benefits?',
    answer:
      'Yes. Upload a benefits handbook or policy document and ask natural-language questions like "How many PTO days do I get after 3 years?" or "What does the dental plan cover?" Each answer cites the specific section of the handbook.',
  },
  {
    question: 'Does it work with company handbooks?',
    answer:
      'Yes. Company handbooks in PDF, DOCX, or other supported formats can be uploaded and queried. DocTalk indexes the full text and lets you ask questions about any policy, procedure, or guideline documented in the handbook.',
  },
];

export default function HrContractsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: 'AI-Powered Contract & HR Document Review',
              description:
                'How HR teams use DocTalk to review employment contracts, company handbooks, and HR policies with AI-powered cited answers.',
              path: '/use-cases/hr-contracts',
              datePublished: '2026-02-18',
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
              { '@type': 'ListItem', position: 3, name: 'HR & Contract Review' },
            ],
          }),
        }}
      />
      <HrContractsClient />
    </>
  );
}
