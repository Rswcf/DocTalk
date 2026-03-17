"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import {
  Briefcase,
  FileText,
  Search,
  BarChart3,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Scale,
  Lock,
  Shield,
} from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Analyze RFPs Faster',
    description:
      'Upload Request for Proposals and ask DocTalk to extract requirements, timelines, evaluation criteria, and budget constraints. Get cited answers from the exact section of the RFP so you never miss a detail.',
  },
  {
    icon: BarChart3,
    title: 'Extract Insights from Market Research',
    description:
      'Upload market research reports, industry analyses, and competitive landscapes. Ask questions about market size, growth rates, or competitive positioning and get answers cited to the specific data source.',
  },
  {
    icon: TrendingUp,
    title: 'Review Client Financials',
    description:
      'Upload financial statements, annual reports, and budget documents. Ask about revenue trends, cost structures, or capital allocation and receive answers with citations to the exact figures in the source.',
  },
  {
    icon: ClipboardCheck,
    title: 'Prepare Due Diligence',
    description:
      'Use Collections to group multiple client documents — contracts, financials, org charts — and run cross-document queries. Identify risks, inconsistencies, and key terms across the full document set.',
  },
];

const exampleQuestions = [
  'What are the key evaluation criteria in this RFP?',
  'What is the total addressable market size mentioned in this report?',
  'Summarize the main competitive threats identified.',
  'What are the payment terms in this contract?',
  'What was the year-over-year revenue growth?',
  'What risks does the management discussion section highlight?',
];

const docTypes = [
  { format: 'PDF Reports', detail: 'Market research, industry analysis, annual reports, and client deliverables' },
  { format: 'DOCX Proposals', detail: 'RFPs, SOWs, engagement letters, and consulting proposals' },
  { format: 'PPTX Decks', detail: 'Client presentations, strategy decks, and pitch materials' },
  { format: 'XLSX Spreadsheets', detail: 'Financial models, budgets, data tables, and forecasts' },
];

const securityItems = [
  { icon: Lock, title: 'AES-256 Encryption', detail: 'All documents encrypted at rest with industry-standard encryption' },
  { icon: Shield, title: 'No AI Training', detail: 'Your documents are never used to train AI models' },
  { icon: FileText, title: 'GDPR Compliant', detail: 'Data export and deletion capabilities for compliance requirements' },
  { icon: CheckCircle, title: 'Account Isolation', detail: 'Each user account is fully isolated — documents are only accessible to you' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload Client Documents', description: 'Upload RFPs, reports, financials, or presentations as PDF, DOCX, PPTX, or XLSX.' },
  { icon: MessageSquare, step: '2', title: 'Ask About the Document', description: 'Type questions about requirements, data points, terms, or anything in the text.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact passage in the original document.' },
];

const faqItems = [
  {
    question: 'Can DocTalk handle confidential client documents?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export and deletion capabilities. Each user account is isolated, and documents are only accessible to the user who uploaded them.',
  },
  {
    question: 'Can I analyze multiple documents at once?',
    answer:
      'Yes. DocTalk supports cross-document Q&A through Collections. You can group related documents — such as an RFP, budget spreadsheet, and org chart — into a single collection and ask questions that span all of them. The AI cites the specific document and passage for each answer.',
  },
  {
    question: 'Does it work with PowerPoint decks?',
    answer:
      'Yes. DocTalk supports PPTX files. You can upload client presentations, pitch decks, and strategy slides. The AI extracts text from all slides and provides cited answers referencing the specific slide content. This is useful for quickly reviewing lengthy presentation decks before client meetings.',
  },
  {
    question: 'What pricing works for consulting firms?',
    answer:
      'DocTalk offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Credit packs are also available for burst usage: Boost (500 credits for $3.99), Power (2,000 for $9.99), and Ultra (5,000 for $19.99). Team plans are on the roadmap.',
  },
  {
    question: 'Can I export analysis results?',
    answer:
      'Yes. Plus and Pro plan users can export chat conversations with all cited answers. This is useful for appending AI analysis summaries to client deliverables or sharing findings with team members who do not have a DocTalk account.',
  },
];

export default function ConsultantsClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">Consultants &amp; Advisors</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI Document Analysis for Consultants and Advisors
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            Analyze RFPs, market research, financial statements, and client documents with AI-powered cited answers. Deliver faster, more thorough analysis.
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
              The Document Challenge for Consultants
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Consultants spend a significant portion of their time reading. Whether it is a 200-page RFP, a stack of market research reports, or a client&apos;s financial statements, the sheer volume of documents requires hours of careful review before any analysis can begin.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                The pressure to deliver thorough analysis quickly means consultants often need to extract specific data points from dense documents under tight deadlines. Missing a key requirement in an RFP or overlooking a risk factor in a financial report can have serious consequences.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Resources like{' '}
                <a href="https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">McKinsey Digital Insights</a>
                {' '}highlight how AI is transforming knowledge work and document analysis in professional services.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                DocTalk accelerates this process by letting you ask questions about any document and receiving answers with exact citations. You can verify every claim against the source in seconds, rather than manually searching through hundreds of pages.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Consultants
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
              Supported Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk works with the formats consultants use daily. See{' '}
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
            Example Questions Consultants Ask
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 mb-6">
            Upload any client document and try questions like these. Every answer includes citations you can click to jump to the original text.
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

        {/* Security & Privacy */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                  Security for Confidential Documents
                </h2>
                <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                  Client confidentiality is non-negotiable for consultants. DocTalk is built with security as a priority.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {securityItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
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
              <Link href="/use-cases/finance" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <TrendingUp className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Finance</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">Analyze 10-K filings, earnings reports, and financial documents</p>
              </Link>
              <Link href="/use-cases/lawyers" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <Scale className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Legal</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">Review contracts, court filings, and legal documents</p>
              </Link>
              <Link href="/use-cases/compliance" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
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
          title="Ready to accelerate your document analysis?"
          description="Upload an RFP, market report, or client document and see how AI-powered cited answers can save hours of review time. No credit card required."
          buttonText="Try Free Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
