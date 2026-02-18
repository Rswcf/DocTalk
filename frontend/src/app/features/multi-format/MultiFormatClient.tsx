"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileType,
  Globe,
  Code2,
  Upload,
  MessageSquare,
  Zap,
  ArrowRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const formats = [
  {
    icon: FileText,
    name: 'PDF',
    ext: '.pdf',
    description: 'Full text extraction with page-level citations and bounding box highlighting. Supports scanned documents, complex layouts, and CJK characters.',
  },
  {
    icon: FileType,
    name: 'DOCX',
    ext: '.docx',
    description: 'Paragraph and table extraction with interleaved body element iteration. Preserves heading structure and table formatting for accurate AI analysis.',
  },
  {
    icon: Presentation,
    name: 'PPTX',
    ext: '.pptx',
    description: 'Slide content and speaker notes extraction with slide-level citations. Navigate directly to the slide the AI references.',
  },
  {
    icon: FileSpreadsheet,
    name: 'XLSX',
    ext: '.xlsx',
    description: 'Table data and cell value extraction with sheet navigation. Ask questions about spreadsheet data and get answers referencing specific cells.',
  },
  {
    icon: Code2,
    name: 'TXT / Markdown',
    ext: '.txt / .md',
    description: 'Plain text and markdown rendering with full formatting support. Markdown tables, code blocks, and headings are preserved.',
  },
  {
    icon: Globe,
    name: 'URL',
    ext: 'Any web page',
    description: 'Web page content extraction and analysis. Paste any URL and chat with the page content using the same citation and highlighting features.',
  },
];

export default function MultiFormatClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              <FileText className="w-4 h-4" />
              7 Formats Supported
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              Chat with Any Document Format Using AI
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              Upload PDF, Word, PowerPoint, Excel, text files, Markdown, or paste any URL. DocTalk
              parses your document, understands its structure, and lets you ask questions with cited
              answers — regardless of the format.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Try It Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Supported Formats Grid */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              Supported Formats
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              DocTalk does not just open your file — it understands the structure, extracts the content
              intelligently, and preserves context for accurate AI analysis.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {formats.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.name}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{f.name}</h3>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">{f.ext}</span>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Multi-Format Matters */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Why Multi-Format Matters
            </h2>
            <div className="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <p>
                Most AI document tools only support PDF. But your actual workflow involves far more
                than PDFs. You receive Word documents from colleagues, review PowerPoint presentations
                from clients, analyze data in Excel spreadsheets, and read web articles you want to
                reference later.
              </p>
              <p>
                With a PDF-only tool, you are forced to convert every document to PDF first — losing
                formatting, breaking tables, and adding friction to every analysis. With DocTalk, you
                upload the original file and start chatting immediately.
              </p>
              <p>
                Each format gets specialized parsing. DOCX files preserve the interleaved paragraph
                and table structure. PPTX files extract both slide content and speaker notes. XLSX
                files maintain cell relationships and sheet organization. This structured extraction
                means the AI understands your document the way you do, not as a flat wall of text.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-12 text-center">
              How It Works
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  icon: Upload,
                  title: 'Upload',
                  description:
                    'Drag and drop any supported file or paste a URL. DocTalk automatically detects the format and selects the right parser. No manual conversion needed.',
                },
                {
                  step: '2',
                  icon: Zap,
                  title: 'Parse',
                  description:
                    'The document is parsed asynchronously using format-specific extractors. Text, tables, headings, and metadata are extracted and indexed for semantic search.',
                },
                {
                  step: '3',
                  icon: MessageSquare,
                  title: 'Chat',
                  description:
                    'Ask any question in the chat panel. The AI searches the extracted content, generates an answer with numbered citations, and lets you click to verify each one.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-lg mx-auto mb-4">
                      {item.step}
                    </div>
                    <Icon className="w-6 h-6 text-zinc-600 dark:text-zinc-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Format-Specific Features */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Format-Specific Features
            </h2>
            <div className="space-y-4">
              {[
                { format: 'PDF', detail: 'Bounding box citation highlighting pinpoints the exact text region on each page. Full CJK (Chinese, Japanese, Korean) character support with proper CMap rendering.' },
                { format: 'DOCX', detail: 'Body element iteration extracts paragraphs and tables in their natural reading order — not as separate lists. Heading hierarchy is preserved for context.' },
                { format: 'PPTX', detail: 'Speaker notes are extracted alongside slide content, giving the AI access to the presenter\'s explanations and context that are not visible on the slides.' },
                { format: 'XLSX', detail: 'Table data is extracted with cell references intact. The AI can answer questions about specific data ranges and reference the source cells.' },
                { format: 'TXT / Markdown', detail: 'Markdown is rendered with full formatting: tables (remark-gfm), code blocks, headings, and lists. Plain text files are displayed with preserved whitespace.' },
                { format: 'URL', detail: 'Web page content is extracted and cleaned, removing navigation, ads, and boilerplate. The article content is then available for AI chat with the same citation features.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="shrink-0 inline-flex items-center justify-center px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-semibold text-zinc-700 dark:text-zinc-300 min-w-[64px] text-center">
                    {item.format}
                  </span>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compared to PDF-Only Tools */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              Compared to PDF-Only Tools
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-10">
              Most AI document chat tools only support PDF. DocTalk handles 7 formats natively.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">Format</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">DocTalk</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">ChatPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">AskYourPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">NotebookLM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {[
                    { format: 'PDF', doctalk: true, chatpdf: true, askyourpdf: true, notebooklm: true },
                    { format: 'DOCX', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
                    { format: 'PPTX', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
                    { format: 'XLSX', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
                    { format: 'TXT / Markdown', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: true },
                    { format: 'URL', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: true },
                    { format: 'Citation highlighting', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
                  ].map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.format}</td>
                      {[row.doctalk, row.chatpdf, row.askyourpdf, row.notebooklm].map((val, j) => (
                        <td key={j} className="text-center px-4 py-3">
                          {val ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4 text-center">
              Comparison based on publicly available feature information as of February 2026.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-6 max-w-3xl mx-auto">
              {[
                {
                  q: 'Can I upload DOCX files?',
                  a: 'Yes. DocTalk fully supports Microsoft Word (.docx) files. It extracts paragraphs, tables, and heading structure while preserving the document layout for accurate AI analysis. Citations link back to specific sections of the document.',
                },
                {
                  q: 'Does DocTalk read PowerPoint slides?',
                  a: 'Yes. Upload any .pptx file and DocTalk extracts both slide content and speaker notes. Citations reference specific slides so you can navigate directly to the source. Slide-level citations work with the same click-to-highlight feature as other formats.',
                },
                {
                  q: 'Can I analyze Excel spreadsheets?',
                  a: 'Yes. DocTalk parses .xlsx files, extracting table data and cell values across sheets. Ask questions about your data — summarize columns, compare rows, find specific values — and get answers that reference the source cells.',
                },
                {
                  q: 'Can I chat with a webpage?',
                  a: 'Yes. Paste any URL and DocTalk extracts the web page content automatically. The extracted text is then available for AI chat with the same citation highlighting feature as any uploaded document.',
                },
                {
                  q: 'What is the maximum file size?',
                  a: 'File size limits depend on your plan: Free accounts can upload files up to 25MB (3 documents), Plus up to 50MB (20 documents), and Pro up to 100MB (unlimited documents). All plans support documents up to 500 pages.',
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
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              Upload Any Document and Start Chatting
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              Try DocTalk free with sample documents, or sign up to upload your own. No credit card
              required for the free plan.
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
                className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                View Pricing
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Citation Highlighting
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                DocTalk vs ChatPDF
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                11 Languages
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
