import type { Metadata } from 'next';
import RealEstateClient from './RealEstateClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Real Estate Professionals',
  description:
    'Review leases, purchase agreements, inspection reports, and property appraisals with AI. Get cited answers from complex real estate documents.',
  path: '/use-cases/real-estate',
  keywords: ['ai for real estate', 'real estate document analysis', 'ai lease review', 'property document ai'],
  openGraph: {
    title: 'AI Document Analysis for Real Estate Professionals | DocTalk',
    description:
      'Review leases, purchase agreements, and inspection reports with AI-powered cited answers. Streamline real estate document review. Try free.',
  },
});

const faqItems = [
  {
    question: 'Can DocTalk review a lease agreement?',
    answer:
      'Yes. Upload a lease as a PDF or DOCX and ask questions like "What is the rent escalation clause?", "What are the maintenance responsibilities?", or "When does the lease terminate?" DocTalk extracts the relevant provisions with numbered citations pointing to the exact section.',
  },
  {
    question: 'Does it work with property inspection PDFs?',
    answer:
      'Yes. DocTalk supports PDF inspection reports. You can ask about specific findings, deficiencies, or recommendations. The AI reads the full report and provides cited answers referencing the exact page and section where each finding appears.',
  },
  {
    question: 'Can I analyze multiple property documents together?',
    answer:
      'Yes. Use Collections to group related documents for a single property — such as the purchase agreement, inspection report, appraisal, and title report. Then ask cross-document questions like "Are there any discrepancies between the inspection report and the seller disclosure?" The AI cites the specific document and passage.',
  },
  {
    question: 'Is client data secure?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any document at any time. Each user account is isolated and documents are only accessible to the uploader.',
  },
  {
    question: 'Is there a free tier for real estate agents?',
    answer:
      'Yes. DocTalk offers a Free plan with 500 credits per month — enough to try the tool on several documents. The Plus plan ($9.99/month) provides 3,000 credits for regular use, and the Pro plan ($19.99/month) includes 9,000 credits with advanced features like Thorough analysis mode.',
  },
];

export default function RealEstatePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: 'AI Document Analysis for Real Estate Professionals',
              description:
                'How real estate professionals use DocTalk to review leases, purchase agreements, and property documents with AI-powered cited answers.',
              path: '/use-cases/real-estate',
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
              { '@type': 'ListItem', position: 3, name: 'Real Estate' },
            ],
          }),
        }}
      />
      <RealEstateClient />
    </>
  );
}
