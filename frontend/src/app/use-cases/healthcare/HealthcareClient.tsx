"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import {
  Heart,
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
  AlertTriangle,
  BookOpen,
  Scale,
} from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Review Clinical Research Papers',
    description:
      'Upload published clinical studies, systematic reviews, or meta-analyses. Ask about study design, sample size, primary endpoints, statistical significance, and conclusions. Get cited answers from the exact section of the paper.',
  },
  {
    icon: ClipboardCheck,
    title: 'Analyze Compliance Documents',
    description:
      'Upload regulatory guidelines, accreditation standards, or compliance frameworks. Ask about specific requirements, deadlines, and obligations. The AI extracts the relevant provisions with numbered citations.',
  },
  {
    icon: BookOpen,
    title: 'Extract Protocol Details',
    description:
      'Upload clinical protocols, standard operating procedures, or treatment guidelines. Ask about dosing schedules, inclusion/exclusion criteria, or procedural steps. Each answer cites the exact section.',
  },
  {
    icon: FileText,
    title: 'Review Insurance Policies',
    description:
      'Upload insurance policy documents and ask about coverage terms, exclusions, pre-authorization requirements, and appeal procedures. Get cited answers pointing to the specific policy clause.',
  },
];

const exampleQuestions = [
  'What were the primary endpoints of this clinical trial?',
  'What is the sample size and patient demographics?',
  'What adverse events were reported in this study?',
  'What are the inclusion criteria for this protocol?',
  'Summarize the compliance requirements in section 3.',
  'What does this policy exclude from coverage?',
];

const docTypes = [
  { format: 'PDF Clinical Studies', detail: 'Published research papers, clinical trial reports, and systematic reviews' },
  { format: 'PDF Compliance Documents', detail: 'Regulatory guidelines, accreditation standards, and audit reports' },
  { format: 'DOCX Protocols', detail: 'Clinical protocols, SOPs, and treatment guidelines' },
  { format: 'PDF Insurance Policies', detail: 'Coverage documents, benefits summaries, and policy amendments' },
];

const steps = [
  { icon: Upload, step: '1', title: 'Upload a Document', description: 'Upload a clinical study, compliance document, protocol, or insurance policy as PDF or DOCX.' },
  { icon: MessageSquare, step: '2', title: 'Ask Your Question', description: 'Type questions about endpoints, requirements, dosing, coverage terms, or anything in the document.' },
  { icon: CheckCircle, step: '3', title: 'Get Cited Answers', description: 'Receive answers with numbered citations. Click any citation to jump to the exact section in the original document.' },
];

const faqItems = [
  {
    question: 'Is DocTalk HIPAA compliant?',
    answer:
      'DocTalk is a general-purpose AI document analysis tool. It is not specifically HIPAA-certified and has not undergone a formal HIPAA compliance audit. We encrypt all documents with AES-256 at rest and never use documents for AI training, but we recommend against uploading documents containing Protected Health Information (PHI). DocTalk is well-suited for reviewing published research, compliance frameworks, protocols, and educational materials that do not contain individual patient data.',
  },
  {
    question: 'Does it work with medical PDFs and research papers?',
    answer:
      'Yes. DocTalk supports PDF, DOCX, PPTX, XLSX, TXT, and Markdown files. You can upload clinical research papers, systematic reviews, medical guidelines, and compliance documents. The AI reads the full document and provides answers with numbered citations pointing to the specific section, table, or paragraph.',
  },
  {
    question: 'Can it help with clinical trial analysis?',
    answer:
      'Yes. Upload a clinical trial report or published study and ask questions like "What were the primary endpoints?", "What was the sample size and demographics?", or "What adverse events were reported?" DocTalk extracts the relevant sections with citations so you can verify every detail against the source.',
  },
  {
    question: 'How does DocTalk handle security for medical documents?',
    answer:
      'All uploaded documents are encrypted with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant, provides data export and deletion capabilities, and each user account is fully isolated. However, as noted above, we recommend against uploading documents with PHI since DocTalk is not HIPAA-certified.',
  },
  {
    question: 'What pricing is available for healthcare professionals?',
    answer:
      'DocTalk offers a Free plan (500 credits/month) to get started, Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). The Pro plan includes Thorough analysis mode, which uses a more capable AI model for complex research papers. Credit packs are also available for burst usage.',
  },
];

export default function HealthcareClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">Healthcare</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Heart className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI Document Analysis for Healthcare Professionals
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            Review clinical studies, compliance documents, protocols, and insurance policies with AI-powered cited answers. Verify every claim against the source.
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-03-18" centered className="mb-8" />
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Try Free Demo <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* Important Notice */}
        <section className="max-w-4xl mx-auto px-6 pb-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Important: Not HIPAA-Certified
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  DocTalk is a general-purpose document analysis tool. It is not HIPAA-certified and should not be used with documents containing Protected Health Information (PHI). It is ideal for reviewing published research, compliance frameworks, protocols, and educational materials.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              The Document Challenge in Healthcare
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Healthcare generates an enormous volume of documentation. Clinical studies can run hundreds of pages. Compliance frameworks are dense and cross-referential. Insurance policies contain layers of provisions, exclusions, and conditions that require careful review.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Healthcare professionals need to stay current with the latest research, ensure compliance with evolving regulations, and review complex policy documents — all while managing demanding clinical or administrative workloads.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Resources like{' '}
                <a href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">PubMed</a>
                {' '}index millions of biomedical articles. Keeping up with relevant literature is a constant challenge for healthcare professionals.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                DocTalk helps by letting you upload any document and ask natural language questions. Every answer comes with numbered citations to the exact passage, so you can verify claims against the source text in seconds.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Healthcare Professionals
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
              Supported Healthcare Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk works with common document formats in healthcare. See{' '}
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
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            Example Questions for Healthcare Documents
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 mb-6">
            Upload any healthcare document (that does not contain PHI) and try questions like these. Every answer includes citations you can click to jump to the original text.
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
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Why Citations Are Critical in Healthcare
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              In healthcare, accuracy is non-negotiable. Unlike general-purpose chatbots that may generate plausible-sounding but unsourced claims, DocTalk bases every answer on the actual text of your uploaded document. It does not rely on general medical knowledge or training data.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              Every answer includes numbered citations that link directly to the exact passage in the original document. When reviewing a clinical study, you can click a citation to jump to the specific table, figure, or paragraph being referenced.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              This is essential for evidence-based practice. You can verify that a statistical finding, dosing recommendation, or safety concern actually appears in the source document before acting on it.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              Learn more about how{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                citation highlighting
              </Link>
              {' '}works in DocTalk, and explore the{' '}
              <Link href="/features/performance-modes" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Thorough analysis mode
              </Link>
              {' '}for complex research papers.
            </p>
          </div>
        </section>

        {/* Security */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                Security &amp; Privacy
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                DocTalk encrypts all documents with AES-256 at rest, never uses documents for AI training, and is GDPR-compliant. However, DocTalk is not HIPAA-certified — please do not upload documents containing Protected Health Information (PHI).
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                DocTalk is ideal for: published research papers, regulatory guidelines, compliance frameworks, clinical protocols (without patient data), insurance policies, and medical educational materials.
              </p>
            </div>
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
            <Link href="/use-cases/compliance" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Compliance</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-300">Analyze regulatory and policy documents</p>
            </Link>
            <Link href="/use-cases/teachers" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <BookOpen className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Teachers</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-300">Review research papers and educational documents</p>
            </Link>
            <Link href="/use-cases/lawyers" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <Scale className="w-5 h-5 text-zinc-600 dark:text-zinc-300 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Legal</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-300">Review contracts, filings, and regulatory documents</p>
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
          title="Ready to accelerate your document review?"
          description="Upload a clinical study, compliance document, or protocol and see how AI-powered cited answers can help. No credit card required."
          buttonText="Try Free Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
