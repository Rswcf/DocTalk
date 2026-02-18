"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ComparisonTable from '../../../components/seo/ComparisonTable';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import { FileText, Languages, Zap, Shield, DollarSign, Quote } from 'lucide-react';

const features = [
  { name: 'Supported Formats', doctalk: '7 (PDF, DOCX, PPTX, XLSX, TXT, MD, URL)', competitor: 'PDF primary + some extras' },
  { name: 'Citation Highlighting', doctalk: true, competitor: false },
  { name: 'Chrome Extension', doctalk: false, competitor: true },
  { name: 'Zotero Plugin', doctalk: false, competitor: true },
  { name: 'API Access', doctalk: false, competitor: true },
  { name: 'Interface Languages', doctalk: '11 languages', competitor: 'English primary' },
  { name: 'No-Signup Demo', doctalk: true, competitor: false },
  { name: 'Multiple AI Modes', doctalk: '3 performance modes', competitor: 'Single model' },
  { name: 'Free Tier', doctalk: '500 credits/mo', competitor: 'Limited free questions' },
  { name: 'Dark Mode', doctalk: true, competitor: false },
];

const faqItems = [
  {
    question: 'Is DocTalk better than AskYourPDF?',
    answer: 'It depends on your needs. DocTalk offers a cleaner, simpler interface with real-time citation highlighting and 7 document formats. AskYourPDF offers more integrations including a Chrome extension, Zotero plugin, and API access. If you value simplicity and citation verification, DocTalk is the better choice. If you need browser integrations or API access, AskYourPDF has the edge.',
  },
  {
    question: 'Does AskYourPDF support citation highlighting?',
    answer: 'AskYourPDF provides page references in its answers, similar to ChatPDF. However, it does not offer the real-time inline citation highlighting that DocTalk provides, where clicking a citation scrolls to and visually highlights the exact passage in your document.',
  },
  {
    question: 'Which tool is easier to use?',
    answer: 'DocTalk is generally simpler to use with its clean, focused interface. AskYourPDF has more features and integrations, which can make it more complex to navigate. DocTalk also offers an instant demo with no signup required, making it the easiest to try.',
  },
  {
    question: 'Can AskYourPDF handle non-PDF documents?',
    answer: 'AskYourPDF primarily focuses on PDF files, though it has added some support for other formats through its plugin ecosystem. DocTalk natively supports 7 formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with dedicated parsers for each format.',
  },
];

export default function AskyourpdfClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/compare" className="hover:text-zinc-700 dark:hover:text-zinc-300">Compare</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">DocTalk vs AskYourPDF</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            DocTalk vs AskYourPDF: Which AI PDF Tool Is Better?
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            DocTalk and AskYourPDF both help you extract information from documents using AI, but they serve
            different use cases. AskYourPDF builds an ecosystem of browser extensions and research integrations,
            while DocTalk focuses on a streamlined experience with real-time citation highlighting across seven
            document formats. Here is a detailed comparison to help you choose the right tool.
          </p>
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              Quick Comparison
            </h2>
            <ComparisonTable features={features} competitorName="AskYourPDF" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            What Is DocTalk?
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            DocTalk is an AI document Q&A platform that supports seven file formats: PDF, DOCX, PPTX, XLSX,
            TXT, Markdown, and web URLs. Its standout feature is real-time citation highlighting, which lets
            you click any citation in an AI answer to instantly scroll to and highlight the exact source passage
            in your document. The interface is available in 11 languages, and three AI performance modes (Quick,
            Balanced, Thorough) let you choose the right tradeoff between speed and depth. DocTalk is built
            for anyone who needs to verify AI answers against original sources, from students writing papers
            to lawyers reviewing contracts.
          </p>
        </section>

        {/* What Is AskYourPDF? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              What Is AskYourPDF?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              AskYourPDF is an AI-powered document analysis tool that has built a comprehensive ecosystem
              around PDF interaction. It offers a Chrome extension for analyzing PDFs directly in your browser,
              a Zotero plugin for academic researchers, and an API for developers to integrate document
              analysis into their own applications. AskYourPDF started as a ChatGPT plugin and has expanded
              into a standalone web platform. The tool focuses on the research workflow, with features like
              reference extraction and citation management. Its broader integration approach makes it popular
              among power users who want to embed document AI into their existing workflows.
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10">
            Feature-by-Feature Comparison
          </h2>

          {/* Document Format Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Document Format Support
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              AskYourPDF was originally built for PDF files and has since added some support for other formats
              through its plugin ecosystem. However, its core experience and parsing quality are strongest
              with PDFs. The tool can handle scanned PDFs through OCR capabilities.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk natively supports seven formats with dedicated parsers for each: PDF with bounding-box
              citations, DOCX with full paragraph and table extraction, PPTX with slide structure and speaker
              notes, XLSX with spreadsheet cell preservation, TXT and Markdown with structure recognition, and
              web URLs with clean article extraction. Each parser is optimized for its format rather than
              converting everything through a single pipeline. See{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                multi-format support
              </Link>{' '}
              for details.
            </p>
          </div>

          {/* AI Answer Quality & Citations */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Quote className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                AI Answer Quality & Citations
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              AskYourPDF references page numbers and can extract citations for academic papers, which is
              particularly useful for researchers building bibliographies. The tool provides competent answers
              for most document types, with particular strength in academic content.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk goes further with real-time citation highlighting. Every citation in an AI answer is
              clickable: click it and the document viewer scrolls to the exact passage with a visual
              highlight. This instant verification means you never need to manually search for the source
              of an answer. For academic and legal work, where every claim must be traceable, this feature
              saves significant time. Learn more about{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                citation highlighting
              </Link>.
            </p>
          </div>

          {/* Language Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Language Support
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              AskYourPDF has a primarily English interface. While the underlying AI can process documents in
              other languages, the user interface, documentation, and integrations are English-only. This
              limits its appeal for non-English-speaking users.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers a fully translated interface in 11 languages, covering approximately 4.5 billion
              native speakers worldwide. Every part of the application, from error messages to billing pages,
              is available in English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian,
              Arabic, and Hindi.
            </p>
          </div>

          {/* Pricing & Free Tier */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Pricing & Free Tier
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              AskYourPDF offers a limited free tier and a Premium plan starting at $14.99 per month that
              includes the Chrome extension, unlimited documents, and priority processing. An Enterprise plan
              is available for teams. The API usage is charged separately based on volume.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk provides a{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">no-signup demo</Link>{' '}
              for instant access, plus a free tier with 500 credits per month. The Plus plan ($9.99/month)
              includes 3,000 credits, Thorough mode, and export features. The Pro plan ($19.99/month)
              adds 9,000 credits and custom instructions. Credit packs are available for one-time top-ups.
              View{' '}
              <Link href="/billing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                full pricing
              </Link>.
            </p>
          </div>

          {/* Performance & Speed */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Performance & Speed
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              AskYourPDF provides good response times for most queries. The Chrome extension enables in-browser
              analysis without needing to upload files separately. Processing large documents may take longer
              depending on the complexity of the queries.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers three AI performance modes to match your needs. Quick mode delivers fast responses
              for simple lookups. Balanced mode provides deeper analysis for nuanced questions. Thorough mode
              gives the most comprehensive answers for complex research tasks. Asynchronous document parsing
              means your file is processed in the background while you start reviewing.
            </p>
          </div>

          {/* Security & Privacy */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Security & Privacy
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              AskYourPDF processes documents on its servers and provides standard security measures. The Chrome
              extension requires browser permissions to function, which some security-conscious users may want
              to evaluate carefully.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk implements SSE-S3 encryption, SSRF protection, magic-byte file validation, and GDPR
              compliance features including data export. No browser extensions are required, and documents
              are never used for AI training. The application runs in non-root Docker containers for
              additional security.
            </p>
          </div>
        </section>

        {/* Who Should Choose DocTalk? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Who Should Choose DocTalk?
            </h2>
            <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Users who need verifiable answers with one-click citation highlighting</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>People who work with multiple document formats (Word, PowerPoint, Excel, web pages)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Non-English speakers who need a localized interface</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Users who prefer a clean, simple interface without browser extensions</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Anyone wanting to try before signing up, via the instant demo</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose AskYourPDF? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            Who Should Choose AskYourPDF?
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Academic researchers who use Zotero and want direct integration</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Users who want to analyze PDFs directly in their browser via a Chrome extension</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Developers who need an API for programmatic document analysis</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Power users who want to integrate document AI into complex research workflows</span>
            </li>
          </ul>
        </section>

        {/* Verdict */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Verdict
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              AskYourPDF has built an impressive ecosystem of integrations that makes it powerful for
              researchers and developers who want to embed document AI into their workflows. The Chrome
              extension and Zotero plugin are genuine differentiators that no other tool in this space matches.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              DocTalk takes a different approach: a focused, polished experience with citation highlighting
              that sets a new standard for answer verification. If your priority is getting accurate, traceable
              answers from mixed document formats with a simple interface, DocTalk is the stronger choice.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              For most document Q&A use cases, DocTalk offers the better balance of features, simplicity, and
              affordability. Power users with specific integration needs should evaluate AskYourPDF. The best
              way to compare is to{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                try DocTalk for free
              </Link>{' '}
              and see the citation highlighting in action. You might also be interested in our{' '}
              <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                DocTalk vs ChatPDF
              </Link>{' '}
              comparison.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Frequently Asked Questions
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Related Pages
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/features/citations', label: 'Citation Highlighting' },
                { href: '/features/multi-format', label: 'Multi-Format Support' },
                { href: '/demo', label: 'Free Demo' },
                { href: '/billing', label: 'Pricing' },
                { href: '/compare/chatpdf', label: 'DocTalk vs ChatPDF' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <CTABanner
          variant="highlight"
          title="Try DocTalk Free — No Signup Required"
          description="See how citation highlighting compares to page references. Upload a document and try it now."
          buttonText="Try the Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
