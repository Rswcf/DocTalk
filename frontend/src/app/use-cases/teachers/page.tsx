import type { Metadata } from 'next';
import TeachersContent from './TeachersContent';
import TeachersJsonLd from './TeachersJsonLd';
import { buildMarketingMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'AI Document Analysis for Teachers and Educators',
  description:
    'Help teachers review lesson plans, research papers, curriculum guides, and student submissions with AI. Get cited answers from any uploaded document.',
  path: '/use-cases/teachers',
  localized: true,
  keywords: ['ai for teachers', 'teacher document analysis', 'ai grading tool', 'education ai tool'],
  openGraph: {
    title: 'AI Document Analysis for Teachers and Educators | DocTalk',
    description:
      'Review lesson plans, research papers, and student submissions with AI-powered cited answers. Save hours on document review. Try free.',
  },
});

export default function TeachersPage() {
  return (
    <>
      <TeachersJsonLd locale="en" />
      <TeachersContent locale="en" />
    </>
  );
}
