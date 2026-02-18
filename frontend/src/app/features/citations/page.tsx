import type { Metadata } from 'next';
import CitationsClient from './CitationsClient';

export const metadata: Metadata = {
  title: 'AI Answers with Source Citations & Highlighting | DocTalk',
  description:
    'Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in your document. Verify every answer. Try free.',
  alternates: { canonical: '/features/citations' },
  openGraph: {
    title: 'AI Answers with Source Citations & Highlighting | DocTalk',
    description:
      'Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in your document. Verify every answer.',
    url: 'https://www.doctalk.site/features/citations',
  },
};

export default function CitationsPage() {
  return (
    <>
      {/* BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
              { '@type': 'ListItem', position: 2, name: 'Features', item: 'https://www.doctalk.site/features' },
              { '@type': 'ListItem', position: 3, name: 'Citations' },
            ],
          }),
        }}
      />

      {/* SoftwareApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DocTalk',
            applicationCategory: 'ProductivityApplication',
            operatingSystem: 'Web',
            url: 'https://www.doctalk.site',
            description:
              'AI document chat with numbered source citations and real-time highlight navigation. Upload PDF, DOCX, PPTX, XLSX and verify every answer.',
            offers: [
              { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: '500 credits/month' },
              { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Plus', description: '3000 credits/month' },
              { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Pro', description: '9000 credits/month' },
            ],
            featureList: [
              'Numbered source citations',
              'Click-to-highlight navigation',
              'Page-level attribution',
              'RAG-powered retrieval',
              '7 document formats',
              '11 languages',
            ],
          }),
        }}
      />

      {/* HowTo */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How citation highlighting works in DocTalk',
            description: 'Get AI answers with verifiable source citations in 3 steps.',
            totalTime: 'PT1M',
            step: [
              {
                '@type': 'HowToStep',
                position: 1,
                name: 'Ask a question about your document',
                text: 'Type any question in the chat panel. DocTalk uses semantic search to find the most relevant passages from your document.',
              },
              {
                '@type': 'HowToStep',
                position: 2,
                name: 'AI generates an answer with numbered citations',
                text: 'The AI responds with a clear answer that includes numbered [1], [2], [3] citations linking to specific source passages.',
              },
              {
                '@type': 'HowToStep',
                position: 3,
                name: 'Click any citation to see the source highlighted',
                text: 'Click a citation number and the document scrolls to the exact source text, highlighted in yellow so you can verify the claim.',
              },
            ],
          }),
        }}
      />

      {/* FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How accurate are the citations?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'DocTalk uses RAG (Retrieval-Augmented Generation) to find the most relevant passages before generating an answer. Each citation points to a specific passage extracted from your document. Accuracy depends on document quality and question specificity, but you can always click any citation to verify it yourself.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I click to see the source?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Every numbered citation in an AI answer is clickable. Clicking it scrolls the document viewer to the exact source passage and highlights it in yellow so you can read the original text in context.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does citation highlighting work with DOCX and PPTX?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Citation highlighting works across all supported formats including PDF, DOCX, PPTX, XLSX, TXT, and Markdown. For PDFs, citations navigate to the exact page and highlight the bounding box. For text-based formats, citations use text-snippet matching to highlight the source passage.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does DocTalk prevent hallucination?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'DocTalk uses RAG to ground every answer in your actual document text. The AI only sees relevant passages retrieved from your document, not general knowledge. Citations let you verify every claim against the source. If the document does not contain the answer, DocTalk will say so rather than make something up.',
                },
              },
              {
                '@type': 'Question',
                name: 'Are citations available on the free plan?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Citation highlighting is available on all plans, including the free tier. Free accounts get 500 credits per month. You can also try citation highlighting in the free demo without creating an account.',
                },
              },
            ],
          }),
        }}
      />

      <CitationsClient />
    </>
  );
}
