"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  TrendingUp,
  Search,
  FileText,
  Table,
  BarChart3,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

const faqItems = [
  {
    question: 'Can DocTalk extract financial data from 10-K filings?',
    answer:
      'Yes. Upload a 10-K filing as a PDF and ask questions like "What was the revenue for fiscal year 2025?" or "What are the main risk factors?" DocTalk extracts the relevant information with numbered citations pointing to the exact section.',
  },
  {
    question: 'Does it support Excel spreadsheets?',
    answer:
      'Yes. DocTalk supports XLSX file uploads. You can upload financial models, budget spreadsheets, and data tables, then ask questions about the data.',
  },
  {
    question: 'How does DocTalk handle financial tables and numbers?',
    answer:
      'DocTalk extracts text from tables in PDF, DOCX, and XLSX documents and converts them to a structured format. When you ask about specific figures, the AI locates the relevant table and cites the exact location.',
  },
  {
    question: 'Is the data secure?',
    answer:
      'Yes. All uploaded documents are encrypted with AES-256 encryption at rest. Your financial documents are never used for AI model training. DocTalk is GDPR-compliant.',
  },
  {
    question: 'Can I analyze earnings call transcripts?',
    answer:
      'Yes. Upload an earnings call transcript as a PDF, DOCX, or TXT file. Ask questions like "What guidance did management provide for Q4?" and get cited answers from the transcript.',
  },
];

export default function FinanceClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">Financial Report Analysis</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI-Powered Financial Report Analysis with Cited Sources
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
            Upload 10-K filings, earnings reports, and investor presentations. Ask questions in plain language and get AI answers with citations pointing to exact figures and sections.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Analyze a Report Free
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The Financial Analysis Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              The Financial Analysis Challenge
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Financial analysis demands extracting precise data from dense, lengthy documents. A typical 10-K filing from a large public company runs 100 to 300 pages, packed with financial statements, footnotes, risk factor disclosures, management discussion and analysis (MD&amp;A), and legal boilerplate. Quarterly 10-Q filings add another layer of data points every three months. Analysts covering multiple companies may need to review thousands of pages each earnings season.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                The critical information is often buried deep. Revenue recognition policy changes might be disclosed in footnote 14 on page 87. A material litigation risk might appear in a single paragraph of the risk factors section. A change in accounting estimates could be mentioned in the MD&amp;A section with an impact quantified only in a supplemental table. Missing these details can mean missing a material investment risk.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Earnings call transcripts present a different challenge. They are conversational in format, often 30 to 50 pages of dialogue between executives and analysts. Finding the specific comment where the CFO discussed margin expectations, or where the CEO addressed a competitive threat, requires reading or searching through the entire transcript.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Time pressure compounds these challenges. During earnings season, analysts need to process new filings within hours, not days. Investment decisions hinge on rapid, accurate extraction of key data points. A tool that accelerates this process while maintaining verifiability directly impacts investment decision quality.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps Financial Analysts */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Financial Analysts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: BarChart3,
                title: 'Extract Key Metrics',
                description: '"What was the revenue growth rate year over year?" or "What was the operating margin for Q3?" DocTalk locates the relevant financial data in the document and returns the answer with a citation pointing to the exact table or paragraph.',
              },
              {
                icon: TrendingUp,
                title: 'Compare Periods',
                description: '"How did Q3 revenue compare to Q2?" or "What changed in the debt structure since last year?" Compare figures across sections of the same filing, with citations to both data points so you can verify the comparison.',
              },
              {
                icon: Search,
                title: 'Summarize Risk Factors',
                description: '"What are the main risk factors?" or "Are there any new risk disclosures this quarter?" DocTalk extracts and summarizes risk factor sections, with each risk cited to its location in the filing.',
              },
              {
                icon: FileText,
                title: 'Find Disclosures',
                description: '"Are there any related-party transactions?" or "What is the revenue recognition policy?" Navigate directly to specific disclosures buried in footnotes and supplementary sections.',
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

        {/* Supported Financial Document Types */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Supported Financial Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk processes{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                7 document formats
              </Link>
              , covering the full range of financial documents analysts encounter daily.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { format: 'PDF 10-K & 10-Q Filings', detail: 'SEC annual and quarterly reports from EDGAR or company investor relations pages. Handles complex multi-column layouts, financial tables, and footnotes.' },
                { format: 'XLSX Financial Models', detail: 'Upload spreadsheets with financial models, budget comparisons, and data tables. Ask questions about specific data points across sheets and columns.' },
                { format: 'DOCX Research Reports', detail: 'Analyst research reports, equity research notes, and internal investment memos in Word format. Extract recommendations, target prices, and key analysis.' },
                { format: 'PPTX Investor Presentations', detail: 'Quarterly earnings presentations, investor day materials, and roadshow decks. Extract key messages, projections, and strategic priorities from slide content.' },
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
            Real-World Financial Use Cases
          </h2>

          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                10-K Annual Report Deep Dive
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                An equity analyst covering a technology company uploads the 200-page 10-K filing and asks: &quot;What was the total revenue and year-over-year growth rate?&quot; DocTalk returns the figures with a citation pointing to the consolidated statements of operations on page 54. A follow-up question, &quot;What are the main risk factors related to competition?&quot; surfaces three specific risk factor paragraphs from pages 18 through 22, each with its own citation.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                The analyst then asks: &quot;What was the change in deferred revenue from the prior year?&quot; DocTalk locates the balance sheet line item and the related footnote explaining the change. In fifteen minutes of targeted questioning, the analyst has extracted the key data points that would have taken an hour or more of manual reading.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Earnings Call Transcript Q&amp;A
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                After an earnings call, an analyst uploads the transcript and asks: &quot;What guidance did management provide for next quarter?&quot; DocTalk identifies the guidance comments from the CFO&apos;s prepared remarks and the Q&amp;A session, providing citations to the specific dialogue. &quot;What did the CEO say about the competitive landscape?&quot; surfaces the relevant exchange between an analyst and the CEO.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                This workflow is especially valuable during earnings season when analysts need to process multiple transcripts in a single day. Instead of reading each 40-page transcript end to end, they can ask the same set of targeted questions across multiple company calls and compare the responses.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Quarterly Comparison Analysis
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                A portfolio manager uploads a company&apos;s Q2 and Q3 10-Q filings in separate sessions. For each, they ask the same set of questions: &quot;What was the gross margin?&quot; &quot;What were the operating expenses by category?&quot; &quot;Were there any impairment charges?&quot; The cited answers from each quarter are compiled into a comparison, with every data point traceable to the specific filing and page. This structured approach to quarterly tracking ensures nothing is missed and every figure is verifiable.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Due Diligence for Investment Decisions
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                A private equity associate performing due diligence on a potential acquisition target uploads the target&apos;s financial statements, shareholder agreements, and key contracts. Targeted questions like &quot;What are the outstanding debt obligations?&quot;, &quot;Are there any change-of-control provisions?&quot;, and &quot;What is the customer concentration risk?&quot; surface relevant information from across multiple documents. Each finding is citation-backed, making it straightforward to compile into a due diligence report that partners can verify.
              </p>
            </div>
          </div>
        </section>

        {/* Why Cited Answers Matter for Finance */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Why Cited Answers Matter for Finance
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              Financial analysis lives and dies by accuracy. A revenue figure off by a few percentage points changes a valuation model. A missed footnote about an accounting policy change can invalidate an entire analysis. In this context, an AI tool that generates answers without verifiable sources is a liability, not an asset.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              DocTalk&apos;s{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                citation highlighting
              </Link>{' '}
              ensures that every number, every claim, and every summary is traceable to a specific passage in the original document. Click a citation, and the document viewer scrolls to the exact source text and highlights it. You see the original table, the original footnote, the original paragraph. No guessing, no trust required.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              This verification capability is what distinguishes DocTalk from general-purpose AI chatbots in a financial analysis workflow. The AI accelerates the search process, but the analyst retains full control over verification. Every figure that goes into a model or a memo has a traceable source in the original filing.
            </p>
          </div>
        </section>

        {/* Excel Support */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Table className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                Direct Excel Spreadsheet Support
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Unlike most AI document tools that only handle PDFs, DocTalk natively supports XLSX file uploads. Upload a financial model, a budget comparison spreadsheet, or a data export directly. The AI processes the tabular data and responds to questions about specific figures, trends, and calculations.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Ask &quot;What is the total in column D?&quot; or &quot;Which quarter had the highest revenue?&quot; DocTalk references the specific cells and sheets in its citations. This eliminates the need to convert spreadsheets to PDF or manually describe data to an AI chatbot.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                For financial professionals who work extensively with Excel, this is a significant workflow improvement. Upload the actual working file, ask questions, and get answers grounded in the real data.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
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
          </div>
        </section>

        {/* CTA Banner */}
        <section className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            Start Analyzing Financial Reports — Free, No Signup
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-xl mx-auto">
            Try DocTalk&apos;s free demo with sample documents. See how AI-powered citation highlighting works on real reports. No account required.
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
        </section>
      </main>
      <Footer />
    </div>
  );
}
