"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  Scale,
  Search,
  FileText,
  Shield,
  Clock,
  Quote,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Lock,
  AlertTriangle,
} from 'lucide-react';

const faqItems = [
  {
    question: 'Is DocTalk secure for confidential legal documents?',
    answer:
      'Yes. DocTalk encrypts all uploaded documents with AES-256 encryption (SSE-S3) at rest. Your documents are never used for AI model training. DocTalk is GDPR-compliant and provides data export functionality for compliance requirements.',
  },
  {
    question: 'Can it analyze contracts?',
    answer:
      'Yes. DocTalk can analyze contracts in PDF, DOCX, and other formats. You can ask questions like "Find all indemnification clauses," "What are the termination conditions?", or "Summarize the liability provisions." Each answer includes numbered citations that link to the exact clause.',
  },
  {
    question: 'How accurate is AI for legal analysis?',
    answer:
      'DocTalk uses Retrieval-Augmented Generation (RAG) to base every answer on the actual text of your document. Every answer includes numbered citations so you can verify each claim. DocTalk is a research acceleration tool, not a substitute for legal judgment.',
  },
  {
    question: 'Does it work with scanned PDFs?',
    answer:
      'DocTalk works best with text-based PDFs where the text layer is preserved. Most modern legal documents produce text-based PDFs. Scanned image-only PDFs without OCR may have limited text extraction.',
  },
  {
    question: 'Is there a team plan?',
    answer:
      'DocTalk currently offers individual plans: Free (500 credits/month), Plus ($9.99/month for 3,000 credits), and Pro ($19.99/month for 9,000 credits). Team and enterprise plans are on the roadmap.',
  },
];

export default function LawyersClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">Legal Document Analysis</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Scale className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI-Powered Legal Document Analysis with Verifiable Citations
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
            Review contracts, court filings, and regulatory documents faster with AI that cites exact clauses. Every answer links to the source text so you can verify before you rely.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Try Document Analysis Free
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The Legal Document Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              The Legal Document Challenge
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Legal work is, at its core, document work. A single corporate transaction can involve hundreds of contracts, disclosures, and regulatory filings. A litigation matter may require reviewing thousands of pages of court records, depositions, and correspondence. The volume is staggering, and the stakes of missing a critical clause are enormous.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Due diligence for an acquisition means systematically reviewing corporate documents to identify risks: unusual liability provisions, change-of-control clauses, pending litigation disclosures, intellectual property assignments, and employment agreements with non-compete provisions. Each document must be read carefully because a single overlooked clause can have millions of dollars in consequences.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Contract review is equally demanding. A 60-page commercial lease contains dozens of interdependent provisions. Termination clauses reference indemnification sections, which in turn reference insurance requirements. Understanding the full picture requires cross-referencing multiple sections, a task that is time-consuming even for experienced attorneys.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                The billable-hour model adds economic pressure. Associates spend significant portions of their time on document review work that, while essential, is repetitive and slow. Any tool that accelerates document review without sacrificing accuracy directly impacts a firm&apos;s efficiency and profitability.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps Legal Professionals */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Legal Professionals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Search,
                title: 'Contract Clause Extraction',
                description: 'Ask "Find all indemnification clauses" or "Where are the termination provisions?" DocTalk scans the entire document and returns every relevant clause with numbered citations pointing to the exact section and page.',
              },
              {
                icon: Clock,
                title: 'Due Diligence Acceleration',
                description: 'Upload corporate documents and ask targeted questions: "Are there any change-of-control provisions?" or "List all pending litigation." Review 100+ documents in a fraction of the time manual review would take.',
              },
              {
                icon: FileText,
                title: 'Filing Summarization',
                description: 'Upload a court filing and ask "Summarize the plaintiff\'s key arguments" or "What precedents are cited?" Get a structured summary with citations to the exact paragraphs in the filing.',
              },
              {
                icon: AlertTriangle,
                title: 'Risk Assessment',
                description: '"Are there any unusual liability provisions?" or "Does this contract contain a non-solicitation clause?" DocTalk flags provisions you ask about, with citations so you can evaluate the exact language.',
              },
              {
                icon: Quote,
                title: 'Key Term Identification',
                description: '"What are the payment terms?" or "When does the non-compete period expire?" Extract specific terms and conditions without reading the entire document, with each answer linked to the source clause.',
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

        {/* Supported Legal Document Types */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Supported Legal Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk processes{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                7 document formats
              </Link>
              , covering the most common file types in legal practice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { format: 'PDF Contracts & Agreements', detail: 'Commercial leases, service agreements, NDAs, employment contracts, licensing agreements, and any other contract type. Handles multi-page documents with complex formatting.' },
                { format: 'DOCX Briefs & Memos', detail: 'Legal memoranda, research briefs, demand letters, and internal analysis documents. Preserves paragraph structure and heading hierarchy for accurate citation.' },
                { format: 'Court Filings & Opinions', detail: 'Complaints, motions, responses, judicial opinions, and appellate briefs in PDF format. Extract arguments, precedents, and procedural history.' },
                { format: 'Regulatory & Patent Documents', detail: 'SEC filings, patent applications, regulatory submissions, and compliance documents. Navigate dense regulatory language with AI-assisted search.' },
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

        {/* Real-World Legal Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Real-World Legal Use Cases
          </h2>

          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Contract Review: Indemnification, Termination, and Liability
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                An associate reviewing a 45-page commercial lease uploads the PDF to DocTalk and asks: &quot;Find all indemnification clauses.&quot; DocTalk returns three results, each with a numbered citation pointing to the exact section. Citation [1] links to Section 14.2, a broad mutual indemnification provision. Citation [2] links to Section 14.3, a carve-out for environmental liability. Citation [3] links to Exhibit B, an additional indemnification related to pre-existing conditions.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                The associate then asks: &quot;What are the termination conditions?&quot; and &quot;Is there a cap on liability?&quot; Each answer references specific clauses with page numbers, allowing the associate to build a clause summary in minutes rather than hours. The citations make it easy to verify the AI&apos;s extraction against the actual contract language.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Due Diligence: Analyzing Corporate Document Stacks
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                During a mid-market acquisition, a legal team needs to review a virtual data room containing corporate bylaws, shareholder agreements, key contracts, and employment agreements. Each document is uploaded individually, and the team runs a consistent set of questions across all of them: &quot;Are there any change-of-control provisions?&quot; &quot;List all non-compete or non-solicitation clauses.&quot; &quot;Are there any pending or threatened litigation disclosures?&quot;
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                DocTalk surfaces relevant provisions from each document with exact citations. The team compiles findings into a due diligence memo, with each finding traceable to a specific document and section. What traditionally takes a team of associates two weeks can be significantly accelerated, with the AI handling initial document screening and the attorneys focusing on legal analysis of the identified provisions.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Court Filing Analysis: Arguments and Precedents
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                A litigator receives opposing counsel&apos;s 30-page motion for summary judgment and needs to understand the key arguments quickly. They upload the filing and ask: &quot;Summarize the main arguments for summary judgment.&quot; DocTalk returns a structured summary, with each argument cited to specific paragraphs in the motion.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Follow-up questions refine the analysis: &quot;What cases does the motion cite for the standard of review?&quot; surfaces the precedent citations. &quot;What facts does opposing counsel rely on for the absence of genuine dispute?&quot; pinpoints the factual arguments. Each answer points to the specific page, allowing the litigator to read the original language in context before drafting a response.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Patent Review: Prior Art and Claims Analysis
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                A patent attorney reviewing a competitor&apos;s patent application uploads the document and asks: &quot;What are the independent claims?&quot; DocTalk extracts the claims with citations to their location in the patent. Follow-up questions like &quot;What prior art is referenced?&quot; and &quot;How does claim 1 differ from the cited prior art?&quot; help the attorney quickly assess the patent&apos;s scope and validity. The citations link directly to the relevant sections of the patent document, making it efficient to cross-reference claims against the specification.
              </p>
            </div>
          </div>
        </section>

        {/* Why Citations Are Critical for Legal Work */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Why Citations Are Critical for Legal Work
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              In legal practice, every assertion must be traceable to a source. You cannot tell a client that &quot;the contract contains an indemnification clause&quot; without pointing to the specific section. You cannot brief a judge on opposing counsel&apos;s arguments without citing the exact paragraphs. Accuracy is not optional; it is a professional obligation.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              General-purpose AI chatbots pose a real risk for legal professionals. They generate answers from training data and may fabricate contract terms, invent case citations, or misstate legal standards. Lawyers have already faced sanctions for relying on AI-generated citations that turned out to be fictitious.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              DocTalk&apos;s{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                citation highlighting system
              </Link>{' '}
              addresses this directly. Every AI answer includes numbered citations that link to specific passages in your uploaded document. Click a citation, and the document viewer scrolls to the exact text and highlights it. The AI cannot fabricate what is not in your document, because its answers are grounded in the actual text through Retrieval-Augmented Generation.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              This makes DocTalk a document navigation tool, not an oracle. It helps you find relevant provisions faster and understand complex documents more quickly. The legal analysis, judgment, and advice remain yours.
            </p>
          </div>
        </section>

        {/* Security & Privacy */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                Security and Privacy
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Legal documents are among the most sensitive files professionals handle. DocTalk takes data security seriously with multiple layers of protection designed for confidential document handling.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Lock, title: 'AES-256 Encryption', detail: 'All uploaded documents are encrypted at rest using AES-256 server-side encryption. Data in transit is protected by TLS.' },
              { icon: Shield, title: 'No AI Training', detail: 'Your documents are never used to train AI models. Document content is processed only to answer your questions and is not retained for model improvement.' },
              { icon: FileText, title: 'GDPR Compliance', detail: 'DocTalk provides data export functionality and honors data deletion requests in compliance with GDPR requirements.' },
              { icon: CheckCircle, title: 'Data Export', detail: 'Export all your data at any time through the account settings. Full GDPR Article 20 data portability support.' },
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
        </section>

        {/* Getting Started */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8 text-center">
              Get Started in 3 Steps
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: Upload,
                  step: '1',
                  title: 'Upload Your Document',
                  description: 'Drag and drop a contract, filing, or memo in PDF or DOCX format. DocTalk extracts and indexes the full text in seconds, preserving document structure.',
                },
                {
                  icon: MessageSquare,
                  step: '2',
                  title: 'Ask Your Question',
                  description: '"Find all indemnification clauses" or "What are the termination conditions?" DocTalk searches the entire document and generates an answer with numbered citations.',
                },
                {
                  icon: CheckCircle,
                  step: '3',
                  title: 'Verify the Source',
                  description: 'Click any citation number to jump to the exact clause in the document. The source text is highlighted so you can read the original language and confirm the AI\'s extraction.',
                },
              ].map((item) => {
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
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {item.description}
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
              Start Reviewing Documents — Free, No Signup
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-xl mx-auto">
              Try DocTalk&apos;s free demo with sample documents. See how AI-powered citation highlighting works on real documents. No account required.
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
