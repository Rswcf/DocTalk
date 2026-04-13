"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import {
  Home,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Lock,
  Shield,
  Scale,
  Briefcase,
  DollarSign,
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Review Lease Agreements',
    description:
      'Upload lease documents and ask about rent escalation clauses, maintenance responsibilities, termination conditions, and renewal options. Get cited answers pointing to the exact provision in the lease.',
  },
  {
    icon: Search,
    title: 'Analyze Inspection Reports',
    description:
      'Upload property inspection PDFs and ask about specific findings, deficiencies, safety concerns, or recommended repairs. The AI cites the exact page and section of the inspection report.',
  },
  {
    icon: DollarSign,
    title: 'Compare Property Appraisals',
    description:
      'Upload appraisal documents and extract comparable sales data, valuation methodology, and adjustment factors. Use Collections to compare appraisals across multiple properties.',
  },
  {
    icon: ClipboardCheck,
    title: 'Extract Terms from Purchase Contracts',
    description:
      'Upload purchase agreements and ask about contingencies, closing dates, earnest money provisions, and seller disclosures. Every answer cites the specific contract clause.',
  },
];

const exampleQuestions = [
  'What is the rent escalation schedule in this lease?',
  'What maintenance responsibilities does the tenant have?',
  'What deficiencies were found in the roof inspection?',
  'What comparable sales were used in this appraisal?',
  'What are the buyer contingencies in this purchase agreement?',
  'When is the lease termination notice deadline?',
];

const docTypes = [
  { format: 'PDF Leases & Contracts', detail: 'Lease agreements, purchase contracts, addendums, and amendments' },
  { format: 'PDF Inspection Reports', detail: 'Home inspections, environmental assessments, and survey reports' },
  { format: 'PDF Appraisals', detail: 'Property appraisals, comparative market analyses, and valuations' },
  { format: 'DOCX Title Documents', detail: 'Title reports, deed descriptions, and HOA documents' },
];

const securityItems = [
  { icon: Lock, title: 'AES-256 Encryption', detail: 'All client documents encrypted at rest with industry-standard encryption' },
  { icon: Shield, title: 'No AI Training', detail: 'Your client documents are never used to train AI models' },
  { icon: FileText, title: 'GDPR Compliant', detail: 'Data export and deletion for compliance with privacy regulations' },
  { icon: CheckCircle, title: 'Account Isolation', detail: 'Each account is fully isolated — client documents are only accessible to you' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload Property Documents', description: 'Upload leases, inspection reports, appraisals, or purchase agreements as PDF or DOCX files.' },
  { icon: MessageSquare, step: '2', title: 'Ask About the Document', description: 'Type questions about specific clauses, findings, valuations, or anything in the document.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact section in the original document.' },
];

const faqItems = [
  {
    question: 'Can DocTalk review a lease agreement?',
    answer:
      'Yes. Upload a lease as a PDF or DOCX and ask questions like "What is the rent escalation clause?", "What are the maintenance responsibilities?", or "When does the lease terminate?" DocTalk extracts the relevant provisions with numbered citations pointing to the exact section.',
  },
  {
    question: 'Does it work with property inspection PDFs?',
    answer:
      'Yes. DocTalk supports PDF inspection reports. You can ask about specific findings, deficiencies, or recommendations. The AI reads the full report and provides cited answers referencing the exact page and section where each finding appears.',
  },
  {
    question: 'Can I analyze multiple property documents together?',
    answer:
      'Yes. Use Collections to group related documents for a single property — such as the purchase agreement, inspection report, appraisal, and title report. Then ask cross-document questions like "Are there any discrepancies between the inspection report and the seller disclosure?" The AI cites the specific document and passage.',
  },
  {
    question: 'Is client data secure?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and you can delete any document at any time. Each user account is isolated and documents are only accessible to the uploader.',
  },
  {
    question: 'Is there a free tier for real estate agents?',
    answer:
      'Yes. DocTalk offers a Free plan with 500 credits per month — enough to try the tool on several documents. The Plus plan ($9.99/month) provides 3,000 credits for regular use, and the Pro plan ($19.99/month) includes 9,000 credits with advanced features like Thorough analysis mode.',
  },
];

export default function RealEstateClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <nav className="flex items-center text-sm text-zinc-500 dark:text-zinc-300 space-x-1">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/use-cases" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Use Cases</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900 dark:text-zinc-100">Real Estate</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Home className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI Document Analysis for Real Estate Professionals
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            Review leases, purchase agreements, inspection reports, and appraisals with AI-powered cited answers. Find the clause you need in seconds.
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
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              The Document Challenge in Real Estate
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Real estate transactions involve a complex web of documents. A single property deal can include a purchase agreement, title report, inspection report, appraisal, seller disclosure, HOA documents, and lease agreements — each running dozens or hundreds of pages.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Agents and brokers need to quickly locate specific terms, compare provisions across documents, and identify potential issues before they become problems. Manually searching through stacks of documents is time-consuming and error-prone.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Resources like the{' '}
                <a href="https://www.nar.realtor/technology" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">National Association of Realtors Technology section</a>
                {' '}discuss how technology is transforming how real estate professionals work with documents and data.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                DocTalk helps by letting you ask natural language questions about any property document and get answers with exact citations. You can verify every detail against the source text in seconds, rather than manually scanning through pages.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Real Estate Professionals
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
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Supported Property Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk works with the document formats used in real estate. See{' '}
              <Link href="/features/multi-format" className="text-blue-600 dark:text-blue-400 hover:underline">
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
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            Example Questions for Real Estate Documents
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 mb-6">
            Upload any property document and try questions like these. Every answer includes citations you can click to jump to the original text.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exampleQuestions.map((q) => (
              <div
                key={q}
                className="flex items-start gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
              >
                <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
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
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                  Security for Client Documents
                </h2>
                <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                  Real estate documents contain sensitive client information. DocTalk is built with security as a priority.
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
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8 text-center">
            Get Started in 3 Steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
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
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Related Use Cases
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/use-cases/lawyers" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <Scale className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Legal</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">Review contracts, court filings, and legal documents</p>
              </Link>
              <Link href="/use-cases/finance" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <DollarSign className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Finance</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">Analyze financial reports and statements</p>
              </Link>
              <Link href="/use-cases/consultants" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <Briefcase className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Consultants</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-300">Analyze RFPs, market research, and client documents</p>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Frequently Asked Questions
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* CTA */}
        <CTABanner
          title="Ready to streamline your document review?"
          description="Upload a lease, inspection report, or purchase agreement and see how AI-powered cited answers can help. No credit card required."
          buttonText="Try Free Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
