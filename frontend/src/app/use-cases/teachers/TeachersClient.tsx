"use client";

import React from 'react';
import Link from 'next/link';
import {
  Apple,
  BookOpen,
  FileText,
  ClipboardCheck,
  Search,
  Upload,
  MessageSquare,
  CheckCircle,
  GraduationCap,
  PenTool,
} from 'lucide-react';
import MarketingShell from '../../../components/marketing/MarketingShell';
import EdPageHero from '../../../components/marketing/EdPageHero';
import EdSection from '../../../components/marketing/EdSection';
import EdProse from '../../../components/marketing/EdProse';
import EdFeatureList from '../../../components/marketing/EdFeatureList';
import EdCardGrid from '../../../components/marketing/EdCardGrid';
import EdStepRow from '../../../components/marketing/EdStepRow';
import EdFaqList from '../../../components/marketing/EdFaqList';
import EdCtaBanner from '../../../components/marketing/EdCtaBanner';

const features = [
  {
    icon: PenTool,
    title: 'Grade Essay Drafts Faster',
    description:
      'Upload student essays and ask DocTalk to identify the thesis statement, key arguments, and supporting evidence. The AI cites exact paragraphs so you can quickly assess structure and content quality.',
  },
  {
    icon: BookOpen,
    title: 'Analyze Curriculum Documents',
    description:
      'Review curriculum guides, standards documents, and syllabus templates. Ask questions like "What learning objectives are specified for grade 8 science?" and get cited answers from the source.',
  },
  {
    icon: Search,
    title: 'Review Research for Lesson Planning',
    description:
      'Upload research papers or educational studies and extract key findings, methodologies, and conclusions. Build evidence-based lesson plans with cited references to the original research.',
  },
  {
    icon: ClipboardCheck,
    title: 'Compare Student Submissions',
    description:
      'Use Collections to group multiple student submissions and ask comparative questions. Identify common themes, unique arguments, or areas where students may need additional support.',
  },
];

const exampleQuestions = [
  'What is the main thesis of this essay?',
  'Summarize the key learning objectives in this curriculum guide.',
  'What evidence does the author provide for their conclusion?',
  'What methodology was used in this educational study?',
  'Compare the arguments made in paragraphs 2 and 5.',
  'What are the assessment criteria described in this rubric?',
];

const docTypes = [
  { format: 'PDF Research Papers', detail: 'Academic journals, educational studies, and published research' },
  { format: 'DOCX Lesson Plans', detail: 'Word documents with lesson plans, rubrics, and worksheets' },
  { format: 'PPTX Lecture Slides', detail: 'PowerPoint presentations and lecture materials' },
  { format: 'XLSX Grade Sheets', detail: 'Spreadsheets with student data, grade tracking, and assessments' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload a Document', description: 'Upload a student essay, research paper, curriculum guide, or any educational document as PDF, DOCX, PPTX, or XLSX.' },
  { icon: MessageSquare, step: '2', title: 'Ask Your Question', description: 'Type a question about the document. Ask about key arguments, learning objectives, methodology, or anything in the text.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive an answer with numbered citations. Click any citation to jump to the exact passage in the original document.' },
];

const faqItems = [
  {
    question: 'Can DocTalk help grade papers?',
    answer:
      'DocTalk can help you review essay drafts and student submissions by extracting key arguments, identifying structure, and finding relevant passages. It provides cited references to the exact paragraphs in student work. However, DocTalk is a document analysis tool — final grading decisions and pedagogical judgment remain with you as the educator.',
  },
  {
    question: 'Does it work with educational PDFs and documents?',
    answer:
      'Yes. DocTalk supports PDF, DOCX, PPTX, XLSX, TXT, and Markdown files. You can upload textbooks, curriculum guides, lesson plans, research papers, and any educational document. The AI reads the full document and provides answers with numbered citations pointing to the exact source text.',
  },
  {
    question: 'Is student data kept private?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any uploaded document at any time. We recommend removing student names from submissions if privacy is a concern.',
  },
  {
    question: 'Can it integrate with my LMS (Canvas, Google Classroom)?',
    answer:
      'DocTalk does not currently integrate directly with LMS platforms like Canvas, Google Classroom, or Blackboard. You can download documents from your LMS and upload them to DocTalk for analysis. LMS integrations are on our roadmap for future development.',
  },
  {
    question: 'Is there a free plan for educators?',
    answer:
      'DocTalk offers a Free plan with 300 credits per month, which is a great starting point for trying the tool. For heavier use, the Plus plan ($9.99/month) provides 3,000 credits, and the Pro plan ($19.99/month) includes 9,000 credits with advanced features like Pro analysis mode and custom instructions.',
  },
];

const relatedUseCases = [
  {
    href: '/use-cases/students',
    icon: GraduationCap,
    title: 'Students',
    description: 'AI document analysis for students and researchers',
  },
  {
    href: '/use-cases/healthcare',
    icon: FileText,
    title: 'Healthcare',
    description: 'Review clinical research and compliance documents',
  },
  {
    href: '/use-cases/compliance',
    icon: ClipboardCheck,
    title: 'Compliance',
    description: 'Analyze regulatory and policy documents',
  },
];

export default function TeachersClient() {
  return (
    <MarketingShell
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Use Cases', href: '/use-cases' },
        { label: 'Teachers & Educators' },
      ]}
    >
      <EdPageHero
        icon={Apple}
        title="AI Document Analysis for Teachers and Educators"
        lede="Review lesson plans, research papers, curriculum guides, and student submissions faster with AI-powered cited answers."
        primaryCta={{ label: 'Try Free Demo', href: '/demo' }}
      />

      <EdSection title="The Document Overload Challenge for Educators">
        <EdProse>
          <p>
            Teachers spend an extraordinary amount of time reviewing documents. From grading student essays and reviewing research papers to analyzing curriculum standards and preparing lesson materials, the volume of text can be overwhelming.
          </p>
          <p>
            A single class of 30 students submitting 5-page essays means 150 pages of careful reading. Multiply that by multiple classes, and the workload becomes unsustainable. Meanwhile, staying current with educational research requires reading dense academic papers.
          </p>
          <p>
            Resources like the{' '}
            <a href="https://www.edweek.org/technology" target="_blank" rel="noopener noreferrer">Education Week Technology section</a>
            {' '}highlight how AI tools are helping educators work more efficiently without replacing pedagogical judgment.
          </p>
          <p>
            DocTalk helps by letting you ask questions about any document and getting answers with exact citations, so you can review documents faster while maintaining the ability to verify every claim against the original text.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title="How DocTalk Helps Educators">
        <EdFeatureList
          items={features.map((f) => ({ title: f.title, body: f.description, icon: f.icon }))}
        />
      </EdSection>

      <EdSection title="Supported Educational Document Types">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          DocTalk works with the document formats teachers use every day. See{' '}
          <Link href="/features/multi-format" className="ed-inline">
            all supported formats
          </Link>
          {' '}for the full list.
        </p>
        <EdCardGrid
          columns={2}
          items={docTypes.map((d) => ({ title: d.format, body: d.detail }))}
        />
      </EdSection>

      <EdSection alt title="Example Questions Teachers Ask">
        <p className="ed-body" style={{ marginBottom: '24px' }}>
          Upload any educational document and try questions like these. Every answer includes citations you can click to jump to the original text.
        </p>
        <EdCardGrid
          columns={2}
          items={exampleQuestions.map((q) => ({ title: q }))}
        />
      </EdSection>

      <EdSection title="Why Citations Matter for Educators">
        <EdProse>
          <p>
            Unlike general-purpose chatbots, DocTalk bases every answer on the actual text of your document. It does not make claims from general knowledge or training data. Every answer includes numbered citations that link to the exact passage in the original document.
          </p>
          <p>
            This is critical for education. When reviewing a student essay, you need to see exactly which paragraph contains a particular argument. When analyzing a research paper, you need to verify that a claimed finding actually appears in the study.
          </p>
          <p>
            Learn more about how{' '}
            <Link href="/features/citations" className="ed-inline">citation highlighting</Link>
            {' '}works in DocTalk, including real-time document navigation.
          </p>
        </EdProse>
      </EdSection>

      <EdSection alt title="Get Started in 3 Steps">
        <EdStepRow
          steps={steps.map((s) => ({ title: s.title, body: s.description, icon: s.icon }))}
        />
      </EdSection>

      <EdSection title="Related Use Cases">
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ gap: '16px', gridAutoRows: '1fr' }}
        >
          {relatedUseCases.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="ed-card h-full"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ marginBottom: '10px', color: 'var(--ed-ink-3)' }}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="ed-h3">{item.title}</h3>
                <p className="ed-body" style={{ marginTop: '8px' }}>
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>
      </EdSection>

      <EdSection alt title="Frequently Asked Questions">
        <EdFaqList items={faqItems} />
      </EdSection>

      <EdCtaBanner
        title="Ready to save hours on document review?"
        description="Upload a lesson plan, research paper, or student essay and see how AI-powered cited answers can help. No credit card required."
        primary={{ label: 'Try Free Demo', href: '/demo' }}
      />
    </MarketingShell>
  );
}
