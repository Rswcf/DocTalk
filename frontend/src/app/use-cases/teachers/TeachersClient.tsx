"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import {
  Apple,
  BookOpen,
  FileText,
  ClipboardCheck,
  Search,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  GraduationCap,
  PenTool,
} from 'lucide-react';

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
      'DocTalk offers a Free plan with 500 credits per month, which is a great starting point for trying the tool. For heavier use, the Plus plan ($9.99/month) provides 3,000 credits, and the Pro plan ($19.99/month) includes 9,000 credits with advanced features like Thorough analysis mode and custom instructions.',
  },
];

export default function TeachersClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <nav className="flex items-center text-sm text-zinc-500 dark:text-zinc-300 space-x-1">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/use-cases" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Use Cases</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900 dark:text-zinc-100">Teachers &amp; Educators</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Apple className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI Document Analysis for Teachers and Educators
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            Review lesson plans, research papers, curriculum guides, and student submissions faster with AI-powered cited answers.
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-03-18" centered className="mb-8" />
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Try Free Demo <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              The Document Overload Challenge for Educators
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Teachers spend an extraordinary amount of time reviewing documents. From grading student essays and reviewing research papers to analyzing curriculum standards and preparing lesson materials, the volume of text can be overwhelming.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                A single class of 30 students submitting 5-page essays means 150 pages of careful reading. Multiply that by multiple classes, and the workload becomes unsustainable. Meanwhile, staying current with educational research requires reading dense academic papers.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Resources like the{' '}
                <a href="https://www.edweek.org/technology" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Education Week Technology section</a>
                {' '}highlight how AI tools are helping educators work more efficiently without replacing pedagogical judgment.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                DocTalk helps by letting you ask questions about any document and getting answers with exact citations, so you can review documents faster while maintaining the ability to verify every claim against the original text.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Educators
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-300">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Supported Document Types */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Supported Educational Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk works with the document formats teachers use every day. See{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                all supported formats
              </Link>
              {' '}for the full list.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {docTypes.map((item) => (
                <div
                  key={item.format}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
                >
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                    {item.format}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-300">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example Questions */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            Example Questions Teachers Ask
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 mb-6">
            Upload any educational document and try questions like these. Every answer includes citations you can click to jump to the original text.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exampleQuestions.map((q) => (
              <div
                key={q}
                className="flex items-start gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
              >
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <span className="text-sm text-zinc-700 dark:text-zinc-200">{q}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Why Citations Matter */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Why Citations Matter for Educators
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              Unlike general-purpose chatbots, DocTalk bases every answer on the actual text of your document. It does not make claims from general knowledge or training data. Every answer includes numbered citations that link to the exact passage in the original document.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              This is critical for education. When reviewing a student essay, you need to see exactly which paragraph contains a particular argument. When analyzing a research paper, you need to verify that a claimed finding actually appears in the study.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              Learn more about how{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                citation highlighting
              </Link>
              {' '}works in DocTalk, including real-time document navigation.
            </p>
          </div>
        </section>

        {/* Getting Started */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8 text-center">
            Get Started in 3 Steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                    {item.step}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-300">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Related Use Cases */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Related Use Cases
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/use-cases/students" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <GraduationCap className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Students</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">AI document analysis for students and researchers</p>
              </Link>
              <Link href="/use-cases/healthcare" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Healthcare</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">Review clinical research and compliance documents</p>
              </Link>
              <Link href="/use-cases/compliance" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <ClipboardCheck className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Compliance</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">Analyze regulatory and policy documents</p>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Frequently Asked Questions
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* CTA */}
        <CTABanner
          title="Ready to save hours on document review?"
          description="Upload a lesson plan, research paper, or student essay and see how AI-powered cited answers can help. No credit card required."
          buttonText="Try Free Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
