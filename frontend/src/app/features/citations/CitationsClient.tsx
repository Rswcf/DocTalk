"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  Quote,
  MousePointerClick,
  Search,
  Shield,
  FileText,
  Scale,
  BarChart3,
  GraduationCap,
  ArrowRight,
  CheckCircle,
  XCircle,
  Minus,
} from 'lucide-react';

export default function CitationsClient() {
  return (
    <>
      <Header variant="minimal" />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              <Quote className="w-4 h-4" />
              Core Feature
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 leading-tight">
              AI Answers You Can Trust: Source Citations with Real-Time Highlighting
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              Every answer DocTalk generates includes numbered citations that link directly to
              the original text in your document. Click any citation to scroll to the source and
              see it highlighted. No more guessing whether the AI got it right.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Try Citation Highlighting
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* How Citation Highlighting Works */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
              How Citation Highlighting Works
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              Three simple steps from question to verified answer. The entire process takes seconds.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  icon: Search,
                  title: 'Ask a question about your document',
                  description:
                    'Type any question in the chat panel. DocTalk uses semantic search (RAG) to find the most relevant passages from your entire document, whether it is 5 pages or 500.',
                },
                {
                  step: '2',
                  icon: FileText,
                  title: 'AI generates an answer with numbered citations',
                  description:
                    'The AI responds with a clear, natural-language answer. Throughout the response, you will see numbered markers like [1], [2], [3] — each one pointing to a specific passage extracted from your document.',
                },
                {
                  step: '3',
                  icon: MousePointerClick,
                  title: 'Click any citation to see the source highlighted',
                  description:
                    'Click a citation number and the document viewer instantly scrolls to the exact source text. The passage is highlighted in yellow so you can read the original context and verify the AI\'s claim yourself.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm mb-4">
                      {item.step}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Citations Matter */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              Why Citations Matter
            </h2>
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                AI hallucination is the biggest unsolved problem in AI document analysis. Language models
                can produce fluent, confident answers that sound completely plausible — but are entirely
                fabricated. Studies show that even the most advanced language models hallucinate facts
                between 3% and 27% of the time, depending on the task.
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                For professionals working with legal contracts, financial reports, academic papers, or
                medical documents, a single hallucinated fact can lead to costly mistakes. The standard
                AI chatbot response of &ldquo;Based on the document...&rdquo; with no source reference gives
                you no way to distinguish a correct answer from a hallucinated one.
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                DocTalk solves this with a citation-first approach. Every answer comes with numbered
                source references. Every reference is clickable. Every click takes you to the exact
                passage in the original document, highlighted so you can read it in context. The AI does
                not just tell you the answer — it shows you where the answer comes from.
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                This transforms the AI from a black box into a transparent research assistant. You get
                the speed of AI with the verifiability of manual research. No more &ldquo;the AI said
                so&rdquo; — you can check every claim, every time.
              </p>
            </div>
          </div>
        </section>

        {/* Three Layers of Citation Accuracy */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
              Three Layers of Citation Accuracy
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              DocTalk does not just append page numbers. It builds citations from three independent layers
              of document understanding.
            </p>

            <div className="space-y-6">
              {[
                {
                  icon: Search,
                  title: 'Layer 1: Source Extraction (RAG Retrieval)',
                  description:
                    'When you ask a question, DocTalk uses Retrieval-Augmented Generation to search your entire document semantically. It finds the most relevant passages — not by keyword matching, but by understanding meaning. The AI only sees these retrieved passages, grounding its answer in your actual document text rather than general knowledge.',
                },
                {
                  icon: FileText,
                  title: 'Layer 2: Page-Level Attribution',
                  description:
                    'Each retrieved passage carries metadata about its location: the page number, section heading, and position in the document. When the AI generates a citation, it attaches this location data so you know exactly where in the document the information came from.',
                },
                {
                  icon: MousePointerClick,
                  title: 'Layer 3: Visual Highlighting Navigation',
                  description:
                    'The final layer is the interactive highlight experience. Click any citation and the document viewer scrolls to the source passage. For PDFs, this uses bounding box coordinates to highlight the exact text region on the page. For DOCX, PPTX, and other text-based formats, it uses progressive text-snippet matching to locate and highlight the passage.',
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex gap-4"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Citation Quality Compared */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
              Citation Quality Compared
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-10">
              Not all AI document tools handle citations the same way. Here is how DocTalk compares.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">Feature</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">DocTalk</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">ChatPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">AskYourPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Humata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {[
                    { feature: 'Numbered inline citations', doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
                    { feature: 'Click-to-highlight navigation', doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
                    { feature: 'Page-level source attribution', doctalk: true, chatpdf: true, askyourpdf: 'partial', humata: 'partial' },
                    { feature: 'Bounding box highlighting (PDF)', doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
                    { feature: 'Text-snippet matching (DOCX/PPTX)', doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
                    { feature: 'Multi-format citation support', doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
                  ].map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.feature}</td>
                      {[row.doctalk, row.chatpdf, row.askyourpdf, row.humata].map((val, j) => (
                        <td key={j} className="text-center px-4 py-3">
                          {val === true ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          ) : val === false ? (
                            <XCircle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mx-auto" />
                          ) : (
                            <Minus className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4 text-center">
              Comparison based on publicly available feature information. &ldquo;Partial&rdquo; means
              the feature exists in a limited form.
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
              Use Cases for Cited Answers
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              Citation highlighting is not a nice-to-have. For these professionals, it is essential.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: GraduationCap,
                  title: 'Academic Research',
                  description:
                    'Verify AI-extracted claims before citing them in your paper. Click through to the original passage to confirm exact wording, check context, and ensure accurate attribution. Never cite something the AI hallucinated.',
                  link: '/use-cases/students',
                  linkText: 'DocTalk for Students',
                },
                {
                  icon: Scale,
                  title: 'Legal Analysis',
                  description:
                    'Navigate to exact contract clauses, specific policy paragraphs, and precise regulatory language. When a client asks about a specific provision, click the citation to read the original clause in full context.',
                  link: '/use-cases/lawyers',
                  linkText: 'DocTalk for Lawyers',
                },
                {
                  icon: BarChart3,
                  title: 'Financial Reports',
                  description:
                    'Reference specific figures, footnotes, and data points in annual reports, earnings calls, and financial filings. Click any citation to jump to the exact table, chart, or paragraph the AI referenced.',
                  link: '/demo',
                  linkText: 'Try the Demo',
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                      {item.description}
                    </p>
                    <Link
                      href={item.link}
                      className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      {item.linkText}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-10 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-6 max-w-3xl mx-auto">
              {[
                {
                  q: 'How accurate are the citations?',
                  a: 'DocTalk uses RAG (Retrieval-Augmented Generation) to find the most relevant passages before generating an answer. Each citation points to a specific passage extracted from your document. Accuracy depends on document quality and question specificity, but you can always click any citation to verify it yourself. The goal is full transparency: you see exactly what the AI saw.',
                },
                {
                  q: 'Can I click to see the source?',
                  a: 'Yes. Every numbered citation in an AI answer is clickable. Clicking it scrolls the document viewer to the exact source passage and highlights it in yellow so you can read the original text in context. For PDFs, this highlights the bounding box region on the page. For other formats, it uses text-snippet matching.',
                },
                {
                  q: 'Does it work with DOCX and PPTX?',
                  a: 'Yes. Citation highlighting works across all 7 supported formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs. The citation navigation adapts to each format — PDF uses bounding box coordinates, while text-based formats use progressive text-snippet matching.',
                },
                {
                  q: 'How does DocTalk prevent hallucination?',
                  a: 'DocTalk grounds every answer in your actual document text using RAG retrieval. The AI only sees the relevant passages from your document, not general knowledge. Citations let you verify every claim. If the information is not in the document, DocTalk will tell you rather than fabricate an answer.',
                },
                {
                  q: 'Are citations available on the free plan?',
                  a: 'Yes. Citation highlighting is available on all plans, including the free tier with 500 credits per month. You can also try it instantly in the free demo without creating an account.',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              See Citations in Action
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              Try the free demo to experience citation highlighting yourself. Upload a document
              or chat with one of our sample files. No account required.
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
                href="/features/multi-format"
                className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                See All Supported Formats
              </Link>
            </div>

            {/* Internal links */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Multi-Format Support
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                DocTalk vs ChatPDF
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/students" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                For Students
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/lawyers" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                For Lawyers
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
