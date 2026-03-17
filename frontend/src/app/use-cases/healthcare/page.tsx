import type { Metadata } from 'next';
import HealthcareClient from './HealthcareClient';
import { buildArticleJsonLd, buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Healthcare Professionals',
  description:
    'Review clinical studies, compliance documents, protocols, and insurance policies with AI. Get cited answers from complex healthcare documents.',
  path: '/use-cases/healthcare',
  keywords: ['ai for healthcare documents', 'medical document analysis ai', 'ai clinical document review', 'healthcare ai tool'],
  openGraph: {
    title: 'AI Document Analysis for Healthcare Professionals | DocTalk',
    description:
      'Review clinical research, compliance documents, and protocols with AI-powered cited answers. Accelerate healthcare document review. Try free.',
  },
});

const faqItems = [
  {
    question: 'Is DocTalk HIPAA compliant?',
    answer:
      'DocTalk is a general-purpose AI document analysis tool. It is not specifically HIPAA-certified and has not undergone a formal HIPAA compliance audit. We encrypt all documents with AES-256 at rest and never use documents for AI training, but we recommend against uploading documents containing Protected Health Information (PHI). DocTalk is well-suited for reviewing published research, compliance frameworks, protocols, and educational materials that do not contain individual patient data.',
  },
  {
    question: 'Does it work with medical PDFs and research papers?',
    answer:
      'Yes. DocTalk supports PDF, DOCX, PPTX, XLSX, TXT, and Markdown files. You can upload clinical research papers, systematic reviews, medical guidelines, and compliance documents. The AI reads the full document and provides answers with numbered citations pointing to the specific section, table, or paragraph.',
  },
  {
    question: 'Can it help with clinical trial analysis?',
    answer:
      'Yes. Upload a clinical trial report or published study and ask questions like "What were the primary endpoints?", "What was the sample size and demographics?", or "What adverse events were reported?" DocTalk extracts the relevant sections with citations so you can verify every detail against the source.',
  },
  {
    question: 'How does DocTalk handle security for medical documents?',
    answer:
      'All uploaded documents are encrypted with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant, provides data export and deletion capabilities, and each user account is fully isolated. However, as noted above, we recommend against uploading documents with PHI since DocTalk is not HIPAA-certified.',
  },
  {
    question: 'What pricing is available for healthcare professionals?',
    answer:
      'DocTalk offers a Free plan (500 credits/month) to get started, Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). The Pro plan includes Thorough analysis mode, which uses a more capable AI model for complex research papers. Credit packs are also available for burst usage.',
  },
];

export default function HealthcarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildArticleJsonLd({
              title: 'AI Document Analysis for Healthcare Professionals',
              description:
                'How healthcare professionals use DocTalk to review clinical studies, compliance documents, and protocols with AI-powered cited answers.',
              path: '/use-cases/healthcare',
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
              { '@type': 'ListItem', position: 3, name: 'Healthcare' },
            ],
          }),
        }}
      />
      <HealthcareClient />
    </>
  );
}
