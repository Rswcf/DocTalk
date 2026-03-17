import type { Metadata } from 'next';
import ConsultantsClient from './ConsultantsClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Consultants and Advisors',
  description:
    'Analyze RFPs, market research reports, financial statements, and client documents with AI. Get cited answers to accelerate consulting workflows.',
  path: '/use-cases/consultants',
  keywords: ['ai for consultants', 'consulting document analysis', 'ai report analysis', 'business document ai'],
  openGraph: {
    title: 'AI Document Analysis for Consultants and Advisors | DocTalk',
    description:
      'Analyze RFPs, market research, and client documents with AI-powered cited answers. Accelerate your consulting workflow. Try free.',
  },
});

const faqItems = [
  {
    question: 'Can DocTalk handle confidential client documents?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export and deletion capabilities. Each user account is isolated, and documents are only accessible to the user who uploaded them.',
  },
  {
    question: 'Can I analyze multiple documents at once?',
    answer:
      'Yes. DocTalk supports cross-document Q&A through Collections. You can group related documents — such as an RFP, budget spreadsheet, and org chart — into a single collection and ask questions that span all of them. The AI cites the specific document and passage for each answer.',
  },
  {
    question: 'Does it work with PowerPoint decks?',
    answer:
      'Yes. DocTalk supports PPTX files. You can upload client presentations, pitch decks, and strategy slides. The AI extracts text from all slides and provides cited answers referencing the specific slide content. This is useful for quickly reviewing lengthy presentation decks before client meetings.',
  },
  {
    question: 'What pricing works for consulting firms?',
    answer:
      'DocTalk offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Credit packs are also available for burst usage: Boost (500 credits for $3.99), Power (2,000 for $9.99), and Ultra (5,000 for $19.99). Team plans are on the roadmap.',
  },
  {
    question: 'Can I export analysis results?',
    answer:
      'Yes. Plus and Pro plan users can export chat conversations with all cited answers. This is useful for appending AI analysis summaries to client deliverables or sharing findings with team members who do not have a DocTalk account.',
  },
];

export default function ConsultantsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: 'AI Document Analysis for Consultants and Advisors',
              description:
                'How consultants and advisors use DocTalk to analyze RFPs, market research, and client documents with AI-powered cited answers.',
              path: '/use-cases/consultants',
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
              { '@type': 'ListItem', position: 3, name: 'Consultants & Advisors' },
            ],
          }),
        }}
      />
      <ConsultantsClient />
    </>
  );
}
