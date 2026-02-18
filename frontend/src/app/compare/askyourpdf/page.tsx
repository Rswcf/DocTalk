import type { Metadata } from 'next';
import AskyourpdfClient from './AskyourpdfClient';

export const metadata: Metadata = {
  title: 'DocTalk vs AskYourPDF: Which AI PDF Tool Is Better?',
  description: 'Compare DocTalk and AskYourPDF for AI document analysis. DocTalk offers citation highlighting and 7 formats; AskYourPDF has Chrome extensions and API plugins. See the full breakdown.',
  alternates: { canonical: '/compare/askyourpdf' },
  openGraph: {
    title: 'DocTalk vs AskYourPDF: Which AI PDF Tool Is Better? | DocTalk',
    description: 'Feature comparison of DocTalk vs AskYourPDF. Citation highlighting, format support, integrations, and pricing.',
    url: 'https://www.doctalk.site/compare/askyourpdf',
  },
};

const faqItems = [
  {
    question: 'Is DocTalk better than AskYourPDF?',
    answer: 'It depends on your needs. DocTalk offers a cleaner, simpler interface with real-time citation highlighting and 7 document formats. AskYourPDF offers more integrations including a Chrome extension, Zotero plugin, and API access. If you value simplicity and citation verification, DocTalk is the better choice. If you need browser integrations or API access, AskYourPDF has the edge.',
  },
  {
    question: 'Does AskYourPDF support citation highlighting?',
    answer: 'AskYourPDF provides page references in its answers, similar to ChatPDF. However, it does not offer the real-time inline citation highlighting that DocTalk provides, where clicking a citation scrolls to and visually highlights the exact passage in your document.',
  },
  {
    question: 'Which tool is easier to use?',
    answer: 'DocTalk is generally simpler to use with its clean, focused interface. AskYourPDF has more features and integrations, which can make it more complex to navigate. DocTalk also offers an instant demo with no signup required, making it the easiest to try.',
  },
  {
    question: 'Can AskYourPDF handle non-PDF documents?',
    answer: 'AskYourPDF primarily focuses on PDF files, though it has added some support for other formats through its plugin ecosystem. DocTalk natively supports 7 formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with dedicated parsers for each format.',
  },
];

export default function CompareAskyourpdfPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'DocTalk vs AskYourPDF: Which AI PDF Tool Is Better?',
            description: 'A detailed comparison of DocTalk and AskYourPDF for AI-powered document analysis.',
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
              { '@type': 'ListItem', position: 2, name: 'Compare', item: 'https://www.doctalk.site/compare' },
              { '@type': 'ListItem', position: 3, name: 'DocTalk vs AskYourPDF' },
            ],
          }),
        }}
      />
      <AskyourpdfClient />
    </>
  );
}
