import type { Metadata } from 'next';
import StudentsClient from './StudentsClient';

export const metadata: Metadata = {
  title: 'AI Research Paper Analysis for Students & Academics | DocTalk',
  description:
    'Analyze research papers, textbooks, and academic documents with AI. Get cited answers with page-level references. Upload PDF, DOCX, or paste a URL. Free to try.',
  alternates: { canonical: '/use-cases/students' },
  openGraph: {
    title: 'AI Research Paper Analysis for Students & Academics | DocTalk',
    description:
      'Analyze research papers, textbooks, and academic documents with AI. Get cited answers with page-level references. Upload PDF, DOCX, or paste a URL. Free to try.',
    url: 'https://www.doctalk.site/use-cases/students',
  },
};

const faqItems = [
  {
    question: 'Can DocTalk summarize a research paper?',
    answer:
      'Yes. Upload any research paper as a PDF, DOCX, or URL, then ask DocTalk to summarize it. The AI will generate a concise summary with numbered citations pointing to specific passages in the paper, so you can verify every key claim against the original text.',
  },
  {
    question: 'Does it work with arXiv papers?',
    answer:
      'Yes. You can paste an arXiv PDF URL directly into DocTalk, or download the PDF and upload it. DocTalk processes the full text including abstracts, methodology sections, results, and references. It works with papers from arXiv, PubMed, IEEE Xplore, JSTOR, Google Scholar, and any other academic repository.',
  },
  {
    question: 'How accurate is AI for academic research?',
    answer:
      'DocTalk uses Retrieval-Augmented Generation (RAG) to ground every answer in your actual document text. The AI only sees relevant passages retrieved from your paper, not general knowledge. Every answer includes numbered citations so you can verify claims against the source. This is fundamentally different from general-purpose AI chatbots that may hallucinate facts.',
  },
  {
    question: 'Is there a student discount?',
    answer:
      'DocTalk offers a generous free tier with 500 credits per month, which is enough for regular academic use. You can also try the instant demo with no signup at all. The Plus plan at $9.99/month and Pro plan at $19.99/month are available for heavy users who need more credits and advanced features like Thorough analysis mode.',
  },
  {
    question: 'Can I upload URLs to papers?',
    answer:
      'Yes. DocTalk supports URL ingestion, so you can paste a link to any publicly accessible paper or web page. DocTalk will fetch the content, extract the text, and let you chat with it just like an uploaded file. This works with arXiv, PubMed Central, university repositories, and any public webpage.',
  },
];

export default function StudentsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'AI-Powered Research Paper Analysis for Students and Academics',
            description:
              'How students and academics use DocTalk to analyze research papers, textbooks, and dissertations with AI-powered cited answers.',
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
              { '@type': 'ListItem', position: 3, name: 'Students & Academics' },
            ],
          }),
        }}
      />
      <StudentsClient />
    </>
  );
}
