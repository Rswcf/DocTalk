"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  FileText,
  Users,
  Search,
  Shield,
  BookOpen,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Lock,
  ClipboardList,
} from 'lucide-react';

const faqItems = [
  {
    question: 'Can DocTalk analyze employment contracts?',
    answer:
      'Yes. Upload an employment contract in PDF or DOCX format and ask questions like "What is the non-compete clause?" or "What are the termination conditions?" DocTalk returns answers with numbered citations pointing to the exact clauses.',
  },
  {
    question: 'Is it secure for sensitive HR documents?',
    answer:
      'Yes. DocTalk encrypts all uploaded documents with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant and supports data export and deletion requests.',
  },
  {
    question: 'Can employees use it to understand their benefits?',
    answer:
      'Yes. Upload a benefits handbook or policy document and ask natural-language questions like "How many PTO days do I get after 3 years?" or "What does the dental plan cover?" Each answer cites the specific section of the handbook.',
  },
  {
    question: 'Does it work with company handbooks?',
    answer:
      'Yes. Company handbooks in PDF, DOCX, or other supported formats can be uploaded and queried. DocTalk indexes the full text and lets you ask questions about any policy, procedure, or guideline documented in the handbook.',
  },
];

export default function HrContractsClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <nav className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 space-x-1">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/use-cases" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Use Cases</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900 dark:text-zinc-100">HR & Contract Review</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI-Powered Contract & HR Document Review
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
            Navigate employment contracts, company handbooks, and HR policies with AI. Get instant answers about specific clauses, benefits, and procedures with verifiable source citations.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Try Document Review Free
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The HR Document Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              The HR Document Challenge
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Human resources departments manage some of the most frequently referenced documents in any organization. Employee handbooks, benefits guides, leave policies, code of conduct documents, and employment contracts collectively define the rules that govern every employee&apos;s working life. These documents are typically lengthy, updated periodically, and contain interconnected provisions that reference each other.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                HR professionals field a constant stream of questions about these documents. &quot;How many PTO days do I accrue after two years?&quot; &quot;What is the policy on remote work for my department?&quot; &quot;Does my non-compete apply if I move to a different state?&quot; Each question requires locating the correct document, finding the relevant section, and interpreting the policy language accurately. Answering incorrectly can have real consequences, from employee grievances to compliance violations.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Employment contracts add another dimension. Each employee may have slightly different terms, and reviewing contracts during onboarding, promotions, or separations requires careful attention to specific clauses. Non-compete provisions, severance terms, intellectual property assignments, and confidentiality agreements all need precise reading.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Compliance requirements make accuracy non-negotiable. HR policies must align with labor law, and the answers HR provides to employees must accurately reflect the documented policies. A tool that accelerates document lookup while maintaining traceability to the source policy is valuable for any HR operation.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps HR Teams */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps HR Teams
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Search,
                title: 'Policy Q&A',
                description: '"What is the remote work policy?" or "How do sick days accumulate?" Upload your employee handbook and get instant answers with citations pointing to the exact section. No more flipping through 100-page handbooks.',
              },
              {
                icon: ClipboardList,
                title: 'Contract Clause Lookup',
                description: '"What is the non-compete period?" or "What are the severance terms?" Upload an employment contract and extract specific clauses with AI, each answer linked to the exact paragraph in the agreement.',
              },
              {
                icon: BookOpen,
                title: 'Handbook Navigation',
                description: 'Upload the entire company handbook and use DocTalk as an intelligent search tool. Ask about any policy, procedure, or guideline and get answers that cite the specific section and page.',
              },
              {
                icon: Users,
                title: 'Onboarding Acceleration',
                description: 'New employees can upload their onboarding documents and ask questions about benefits enrollment deadlines, required trainings, and company policies. Every answer points to the source document for verification.',
              },
            ].map((item) => {
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
              Supported HR Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk supports{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                7 document formats
              </Link>
              , covering the most common file types used by HR departments.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { format: 'DOCX Employment Contracts', detail: 'Employment agreements, offer letters, amendment letters, and separation agreements. Extract specific clauses like non-compete, confidentiality, and compensation terms.' },
                { format: 'PDF Company Handbooks', detail: 'Employee handbooks, policy manuals, and code of conduct documents. Navigate hundreds of pages with AI-assisted search and get cited answers.' },
                { format: 'PPTX Training Materials', detail: 'Onboarding presentations, compliance training decks, and policy overview slides. Ask questions about training content with citations to specific slides.' },
                { format: 'XLSX Benefits Tables', detail: 'Benefits comparison tables, compensation grids, and PTO accrual schedules. Ask about specific tiers, rates, and eligibility criteria.' },
              ].map((item) => (
                <div
                  key={item.format}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
                >
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                    {item.format}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Real-World Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Real-World HR Use Cases
          </h2>

          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                PTO Policy Lookup
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                An HR generalist receives an employee question about PTO accrual after a recent policy update. Instead of searching through the 120-page employee handbook manually, they upload it to DocTalk and ask: &quot;How many PTO days does an employee accrue after 3 years of service?&quot; DocTalk returns the answer with a citation pointing to Section 7.2 on page 43, the exact PTO accrual table. The HR generalist can verify the answer against the source and respond to the employee with confidence, citing the specific handbook section.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Non-Compete and Non-Solicitation Review
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                During an employee separation, the HR director needs to review the departing employee&apos;s non-compete provisions. They upload the employment agreement and ask: &quot;What are the non-compete restrictions?&quot; DocTalk extracts the non-compete clause with a citation to Section 9(a), including the geographic scope, duration, and restricted activities. A follow-up question, &quot;Is there a non-solicitation clause?&quot; surfaces Section 9(b) with the client and employee non-solicitation terms. For additional legal context, the{' '}
                <Link href="/use-cases/lawyers" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  legal document analysis
                </Link>{' '}
                workflow provides deeper contract review capabilities.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Benefits Comparison
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                During open enrollment, an HR specialist needs to answer employee questions about plan differences. They upload the benefits guide in XLSX format and ask: &quot;What is the difference between the Gold and Silver health plans?&quot; DocTalk compares the two plans with citations to the specific rows in the comparison table. &quot;What is the annual deductible for the Gold plan?&quot; returns the exact figure with a citation. This enables rapid, accurate responses during the high-volume enrollment period.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                New Employee Onboarding
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                A new employee starting at a company receives a stack of onboarding documents: the employee handbook, benefits enrollment guide, IT security policy, and code of conduct. Instead of reading hundreds of pages in their first week, they upload each document and ask practical questions: &quot;When is the deadline to enroll in health insurance?&quot; &quot;What is the dress code policy?&quot; &quot;How do I request time off?&quot; Each answer comes with a citation, so the employee can read the full policy context when needed while getting quick answers for immediate questions.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy & Security */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                  Privacy and Security for Sensitive HR Data
                </h2>
                <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                  HR documents contain some of the most sensitive information in any organization: compensation details, personal employee data, disciplinary records, and contractual terms. DocTalk handles this data with appropriate security measures.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Lock, title: 'AES-256 Encryption', detail: 'All documents encrypted at rest with AES-256 server-side encryption. Data in transit protected by TLS.' },
                { icon: Shield, title: 'No AI Training', detail: 'Your HR documents are never used to train AI models. Content is processed only to answer your questions.' },
                { icon: FileText, title: 'GDPR Compliance', detail: 'Full compliance with GDPR requirements including data export and deletion capabilities.' },
                { icon: CheckCircle, title: 'Data Control', detail: 'Export or delete your data at any time. You maintain full control over your uploaded documents.' },
              ].map((item) => {
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
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
              >
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {item.question}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              Start Reviewing HR Documents — Free, No Signup
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-xl mx-auto">
              Try DocTalk&apos;s free demo with sample documents. See how AI-powered citation highlighting works. No account required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Try the Free Demo
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/billing"
                className="inline-flex items-center px-6 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
