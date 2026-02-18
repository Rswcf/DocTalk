import type { Metadata } from 'next';
import MultiFormatClient from './MultiFormatClient';

export const metadata: Metadata = {
  title: 'Chat with Any Document: PDF, DOCX, PPTX, XLSX & More | DocTalk',
  description:
    'Upload PDF, Word, PowerPoint, Excel, TXT, Markdown, or any URL. DocTalk\'s AI reads your document and answers questions with cited sources. Try free.',
  alternates: { canonical: '/features/multi-format' },
  openGraph: {
    title: 'Chat with Any Document: PDF, DOCX, PPTX, XLSX & More | DocTalk',
    description:
      'Upload PDF, Word, PowerPoint, Excel, TXT, Markdown, or any URL. DocTalk\'s AI reads your document and answers questions with cited sources.',
    url: 'https://www.doctalk.site/features/multi-format',
  },
};

export default function MultiFormatPage() {
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
              { '@type': 'ListItem', position: 3, name: 'Multi-Format Support' },
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
              'AI document chat supporting 7 formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Upload any document and get cited answers.',
            offers: [
              { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free', description: '500 credits/month' },
              { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Plus', description: '3000 credits/month' },
              { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Pro', description: '9000 credits/month' },
            ],
            featureList: [
              'PDF with page-level citations',
              'DOCX paragraph and table extraction',
              'PPTX slide and speaker notes',
              'XLSX table data and cell values',
              'TXT and Markdown rendering',
              'URL web page analysis',
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
                name: 'Can I upload DOCX files?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. DocTalk fully supports Microsoft Word (.docx) files. It extracts paragraphs, tables, and heading structure, preserving the document layout for accurate AI analysis and cited answers.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does DocTalk read PowerPoint slides?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Upload any .pptx file and DocTalk extracts slide content, speaker notes, and provides slide-level citations so you can navigate directly to the relevant slide.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I analyze Excel spreadsheets?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. DocTalk parses .xlsx files, extracting table data and cell values. You can ask questions about the data and get answers that reference specific cells and sheets.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I chat with a webpage?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Paste any URL and DocTalk extracts the web page content, then lets you ask questions about it with the same citation highlighting as any uploaded document.',
                },
              },
              {
                '@type': 'Question',
                name: 'What is the maximum file size?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'File size limits depend on your plan: Free accounts can upload files up to 25MB, Plus up to 50MB, and Pro up to 100MB. Documents can be up to 500 pages.',
                },
              },
            ],
          }),
        }}
      />

      <MultiFormatClient />
    </>
  );
}
