"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import {
  Shield,
  FileText,
  Search,
  ClipboardCheck,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Lock,
  AlertTriangle,
  GitCompare,
  Scale,
  Heart,
  TrendingUp,
} from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Analyze Regulatory Documents',
    description:
      'Upload regulations, guidelines, or standards and ask about specific requirements, definitions, timelines, and penalties. Get cited answers pointing to the exact section, clause, or article in the regulatory text.',
  },
  {
    icon: AlertTriangle,
    title: 'Review Internal Policies for Gaps',
    description:
      'Upload your internal policies alongside the relevant regulation using Collections. Ask the AI to identify where your policy addresses — or fails to address — specific regulatory requirements.',
  },
  {
    icon: ClipboardCheck,
    title: 'Extract Requirements from Frameworks',
    description:
      'Upload compliance frameworks (SOC 2, ISO 27001, NIST, etc.) and extract specific controls, requirements, and evidence criteria. Every answer cites the exact framework section.',
  },
  {
    icon: GitCompare,
    title: 'Compare Policy Versions',
    description:
      'Upload two versions of a policy into a Collection and ask what changed. The AI identifies additions, removals, and modifications with citations to both versions so you can track policy evolution.',
  },
];

const exampleQuestions = [
  'What are the data retention requirements in this regulation?',
  'What penalties apply for non-compliance with section 12?',
  'Summarize the reporting obligations for data breaches.',
  'Does our internal policy address the encryption requirements in section 5.3?',
  'What controls does SOC 2 Type II require for access management?',
  'What changed between v2.1 and v3.0 of this policy?',
];

const docTypes = [
  { format: 'PDF Regulations', detail: 'Federal and state regulations, guidelines, directives, and standards' },
  { format: 'PDF Compliance Frameworks', detail: 'SOC 2, ISO 27001, NIST CSF, GDPR text, and industry standards' },
  { format: 'DOCX Internal Policies', detail: 'Company policies, procedures, handbooks, and governance documents' },
  { format: 'PDF Audit Reports', detail: 'Internal and external audit reports, findings, and remediation plans' },
];

const realWorldCases = [
  {
    title: 'Regulatory Gap Analysis',
    description:
      'Upload a new regulation and your existing compliance policy into a Collection. Ask DocTalk to identify which requirements in the regulation are not addressed by your current policy. The AI provides cited answers from both documents, making it easy to create a remediation plan.',
  },
  {
    title: 'Audit Preparation',
    description:
      'Upload the compliance framework you are being audited against (e.g., SOC 2 Trust Services Criteria) and ask about each control requirement. DocTalk extracts the specific criteria and evidence expectations, helping you prepare documentation before the auditor arrives.',
  },
  {
    title: 'Cross-Jurisdictional Review',
    description:
      'Upload regulations from multiple jurisdictions into a Collection and compare requirements. Ask questions like "How do the data breach notification timelines differ?" to understand varying obligations across regions.',
  },
];

const securityItems = [
  { icon: Lock, title: 'AES-256 Encryption', detail: 'All documents encrypted at rest with industry-standard encryption' },
  { icon: Shield, title: 'No AI Training', detail: 'Your compliance documents are never used to train AI models' },
  { icon: FileText, title: 'GDPR Compliant', detail: 'Data export and deletion capabilities for your compliance needs' },
  { icon: CheckCircle, title: 'Account Isolation', detail: 'Each account is fully isolated — documents are only accessible to you' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload Compliance Documents', description: 'Upload regulations, policies, frameworks, or audit reports as PDF or DOCX files.' },
  { icon: MessageSquare, step: '2', title: 'Ask About Requirements', description: 'Type questions about specific obligations, controls, definitions, or gaps.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact section in the original document.' },
];

const faqItems = [
  {
    question: 'Can DocTalk analyze regulatory documents?',
    answer:
      'Yes. Upload regulatory texts, guidelines, or standards as PDF or DOCX files and ask questions like "What are the data retention requirements?", "What penalties apply for non-compliance?", or "Summarize the reporting obligations." DocTalk extracts the relevant provisions with numbered citations to the exact section.',
  },
  {
    question: 'Does it support cross-document analysis?',
    answer:
      'Yes. Use Collections to group related documents — such as a regulation, your internal policy, and an audit report. Then ask questions that span all documents, like "Does our internal policy cover all requirements in the regulation?" The AI cites the specific document and passage for each point.',
  },
  {
    question: 'Can it analyze SEC filings and financial regulations?',
    answer:
      'Yes. DocTalk can analyze SEC filings (10-K, 10-Q, 8-K), banking regulations, insurance compliance documents, and other financial regulatory texts. Upload the document and ask specific questions about requirements, deadlines, or definitions. Each answer includes citations to the source text.',
  },
  {
    question: 'Is there an audit trail for compliance reviews?',
    answer:
      'DocTalk preserves the full conversation history for each document session, including all questions asked and answers with their citations. Plus and Pro plan users can export these conversations. This provides a record of what was reviewed and what the AI found, though it is not a formal audit system.',
  },
  {
    question: 'What pricing works for compliance teams?',
    answer:
      'DocTalk offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). The Pro plan includes Thorough analysis mode for complex regulatory documents and custom instructions for specialized compliance frameworks. Team plans are on the roadmap.',
  },
];

export default function ComplianceClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">Compliance &amp; Risk</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI Document Analysis for Compliance and Risk Teams
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            Analyze regulations, internal policies, audit reports, and compliance frameworks with AI-powered cited answers. Cross-reference documents to find gaps.
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
              The Document Challenge for Compliance Teams
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Compliance teams live in a world of documents. Regulations, internal policies, compliance frameworks, audit reports, and vendor assessments create a dense web of requirements that must be understood, cross-referenced, and acted upon.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                A single regulation can run hundreds of pages. When a new regulation is enacted or an existing one is updated, compliance teams must review the full text, identify new or changed requirements, and map them to existing internal controls — a process that can take weeks.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Resources like the{' '}
                <a href="https://www.complianceweek.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Compliance Week</a>
                {' '}report on how regulatory complexity continues to grow across industries, increasing the document review burden for compliance professionals.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                DocTalk accelerates this process by letting you ask natural language questions about any compliance document and receive answers with exact citations. Cross-document analysis through Collections enables gap analysis between regulations and internal policies.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Compliance Teams
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
              Supported Compliance Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk works with the document formats used in compliance and risk management. See{' '}
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

        {/* Real-World Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Real-World Compliance Use Cases
          </h2>
          <div className="space-y-10">
            {realWorldCases.map((item) => (
              <div key={item.title}>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  {item.title}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Example Questions */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Example Questions for Compliance Documents
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              Upload any compliance document and try questions like these. Every answer includes citations you can click to jump to the original text.
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
          </div>
        </section>

        {/* Security & Privacy */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                Security for Compliance Documents
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Compliance documents often contain sensitive internal information. DocTalk is built with security as a priority.
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
        </section>

        {/* Getting Started */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
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
          </div>
        </section>

        {/* Related Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
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
              <TrendingUp className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Finance</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-300">Analyze financial reports and SEC filings</p>
            </Link>
            <Link href="/use-cases/healthcare" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <Heart className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Healthcare</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-300">Review clinical research and compliance documents</p>
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              Frequently Asked Questions
            </h2>
            <FAQSection items={faqItems} />
          </div>
        </section>

        {/* CTA */}
        <CTABanner
          title="Ready to streamline compliance document review?"
          description="Upload a regulation, policy, or audit report and see how AI-powered cited answers can accelerate your compliance workflow. No credit card required."
          buttonText="Try Free Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
