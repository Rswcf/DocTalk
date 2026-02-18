import type { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: { absolute: 'DocTalk — AI Document Chat with Cited Answers' },
  description: 'Upload any document and chat with AI. Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
    type: 'website',
    url: 'https://www.doctalk.site',
    siteName: 'DocTalk',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DocTalk — AI Document Chat',
    description: 'Chat with your documents. AI answers with page-level citations.',
  },
};

export default function HomePage() {
  return (
    <>
      {/* FAQPage JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How accurate are the AI answers?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Every answer includes numbered citations that link to the exact passage in your document. Click any citation to jump to the source and see it highlighted. You always verify the AI\'s work yourself.',
            },
          },
          {
            '@type': 'Question',
            name: 'What file types are supported?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'DocTalk supports PDF, DOCX, PPTX, XLSX, TXT, and Markdown files, plus web URLs. PDFs include scanned documents via built-in OCR. Files up to 50MB and 500 pages are supported.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is my data secure?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Absolutely. Your documents are TLS encrypted in transit and AES-256 encrypted at rest, never used for AI training, and you can delete them anytime. We follow privacy-first principles.',
            },
          },
          {
            '@type': 'Question',
            name: 'Which AI models can I use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'DocTalk offers 3 performance modes — Quick, Balanced, and Thorough — each optimized with different AI models for different needs. Free users can use Quick and Balanced modes. Upgrade to Plus to unlock Thorough mode.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is there a free tier?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! Free accounts include 500 credits per month, enough for dozens of questions. No credit card required to get started.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can it handle long documents?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. DocTalk handles documents up to 500 pages with smart chunking and semantic search, ensuring accurate answers even from very long documents.',
            },
          },
        ],
      })}} />

      {/* SoftwareApplication JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'DocTalk',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        url: 'https://www.doctalk.site',
        description: 'AI-powered document chat with cited answers. Upload PDF, DOCX, PPTX, XLSX and get instant answers with source citations.',
        offers: [
          { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: '500 credits/month' },
          { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Plus', description: '3000 credits/month' },
          { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Pro', description: '9000 credits/month' },
        ],
        featureList: ['PDF chat', 'DOCX analysis', 'PPTX analysis', 'XLSX analysis', 'Citation highlighting', 'OCR support', '11 languages', '3 AI performance modes'],
      })}} />

      {/* HowTo JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to chat with your documents using DocTalk',
        description: 'Upload any document and get AI-powered answers with source citations in 3 simple steps.',
        totalTime: 'PT2M',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Upload your document',
            text: 'Upload a PDF, Word, PowerPoint, Excel, or text file, or paste a web URL. Drag, drop, done.',
            url: 'https://www.doctalk.site/#how-it-works',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Ask questions',
            text: 'Type naturally — like asking a colleague who just read the whole thing.',
            url: 'https://www.doctalk.site/#how-it-works',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Get verified answers',
            text: 'Every answer cites specific pages. Click a citation to jump straight to the source.',
            url: 'https://www.doctalk.site/#how-it-works',
          },
        ],
      })}} />

      <HomePageClient />
    </>
  );
}
