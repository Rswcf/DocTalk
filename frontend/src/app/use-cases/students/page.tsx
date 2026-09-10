import type { Metadata } from 'next';
import StudentsContent from './StudentsContent';
import StudentsJsonLd from './StudentsJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Research Paper Analysis for Students',
  description:
    'Analyze research papers, textbooks, and academic documents with AI. Get cited answers with page-level references from PDFs, DOCX files, and URLs.',
  path: '/use-cases/students',
  localized: true,
  keywords: ['ai for students', 'student pdf tool', 'research paper ai', 'academic document chat'],
  openGraph: {
    title: 'AI Research Paper Analysis for Students | DocTalk',
    description:
      'Analyze research papers, textbooks, and academic documents with AI. Get cited answers with page-level references. Upload PDF, DOCX, or paste a URL. Free to try.',
  },
});

export default function StudentsPage() {
  return (
    <>
      <StudentsJsonLd locale="en" />
      <StudentsContent locale="en" />
    </>
  );
}
