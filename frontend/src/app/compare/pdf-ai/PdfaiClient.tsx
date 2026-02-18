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
  { name: 'Supported Formats', doctalk: '7 (PDF, DOCX, PPTX, XLSX, TXT, MD, URL)', competitor: 'PDF only' },
  { name: 'Citation Highlighting', doctalk: true, competitor: false },
  { name: 'Interface Languages', doctalk: '11 languages', competitor: 'English only' },
  { name: 'No-Signup Demo', doctalk: true, competitor: false },
  { name: 'Multiple AI Modes', doctalk: '3 performance modes', competitor: 'Single model' },
  { name: 'Free Tier', doctalk: '500 credits/mo', competitor: 'Limited free queries' },
  { name: 'Web URL Ingestion', doctalk: true, competitor: false },
  { name: 'Dark Mode', doctalk: true, competitor: false },
  { name: 'Data Encryption', doctalk: 'SSE-S3', competitor: 'Standard' },
  { name: 'Active Development', doctalk: 'Actively maintained', competitor: 'Reduced updates' },
];

const faqItems = [
  {
    question: 'Is PDF.ai still active?',
    answer: 'PDF.ai continues to operate, but it has seen less development and growth compared to competitors. The tool focuses on basic PDF chat functionality without the advanced features that newer tools like DocTalk offer, such as citation highlighting and multi-format support.',
  },
  {
    question: 'Does PDF.ai support Word or Excel files?',
    answer: 'No. PDF.ai only supports PDF files. To analyze Word, PowerPoint, or Excel documents, you would need to convert them to PDF first. DocTalk natively supports 7 formats including DOCX, PPTX, and XLSX with dedicated parsers for each.',
  },
  {
    question: 'Which tool has better citations?',
    answer: 'DocTalk has significantly better citation support with real-time visual highlighting. When you click a citation, the document viewer scrolls to and highlights the exact source passage. PDF.ai provides basic page references without inline highlighting.',
  },
  {
    question: 'Is DocTalk more expensive than PDF.ai?',
    answer: 'DocTalk offers a free demo with no signup and a free tier with 500 credits per month. Paid plans start at $9.99/month. PDF.ai pricing varies, but DocTalk generally provides more features per dollar, including citation highlighting, 7 format support, and 11 languages.',
  },
];

export default function PdfaiClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">DocTalk vs PDF.ai</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            DocTalk vs PDF.ai: AI PDF Tool Comparison (2026)
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            PDF.ai was one of the earlier entrants in the AI PDF chat space, offering a straightforward
            way to ask questions about PDF files. DocTalk has expanded the concept significantly with
            seven-format support, real-time citation highlighting, and an 11-language interface. Here is
            how these two tools compare across features, pricing, and overall capability in 2026.
          </p>
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              Quick Comparison
            </h2>
            <ComparisonTable features={features} competitorName="PDF.ai" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            What Is DocTalk?
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            DocTalk is a modern AI document Q&A platform supporting seven file formats: PDF, DOCX, PPTX,
            XLSX, TXT, Markdown, and web URLs. Its standout feature is real-time citation highlighting,
            where clicking any citation in an AI answer scrolls to and visually highlights the exact source
            passage in a side-by-side document viewer. The interface is fully localized in 11 languages
            with three AI performance modes (Quick, Balanced, Thorough). DocTalk offers a free demo
            requiring no signup, a free tier with 500 credits per month, and paid plans starting at $9.99.
            It is actively developed with regular feature additions and security improvements.
          </p>
        </section>

        {/* What Is PDF.ai? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              What Is PDF.ai?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              PDF.ai is a web-based tool that lets users upload PDF files and ask questions about their
              content using AI. Launched during the initial wave of AI document tools in 2023, PDF.ai
              offers a clean, simple interface focused exclusively on PDF interaction. The tool provides
              basic question-answering with page number references. PDF.ai attracted early users with its
              memorable domain name and simple approach. However, development has slowed compared to
              competitors, and the feature set has not expanded significantly. The tool remains functional
              for basic PDF Q&A but lacks the advanced features found in newer alternatives.
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
              PDF.ai supports only PDF files, as its name suggests. There is no support for Word documents,
              spreadsheets, presentations, or web pages. If you need to analyze a non-PDF document, you
              must convert it to PDF first, which adds friction and can introduce formatting errors.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk supports seven formats natively: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs.
              Each format has a dedicated parser that preserves the original document structure, including
              tables, headings, slide order, and spreadsheet cell relationships. This eliminates the
              conversion step entirely and produces cleaner input for the AI, leading to better answers. See{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                multi-format support
              </Link>.
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
              PDF.ai provides basic Q&A with page number references. The answers are generally competent
              for straightforward questions. However, the citation system is limited to page numbers without
              any visual highlighting or precise source identification.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk provides real-time citation highlighting that represents a significant advancement.
              Every citation in an AI response is clickable. Clicking it scrolls the document viewer to the
              exact passage and applies a visual highlight, allowing instant verification. For PDF documents,
              bounding-box coordinates enable pixel-accurate highlighting. This feature is the core
              differentiator that makes DocTalk particularly valuable for academic, legal, and professional
              research. Learn more about{' '}
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
              PDF.ai has an English-only interface with no localization for other languages. While the AI
              can process non-English PDFs to some degree, the interface experience is exclusively English.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers full interface localization in 11 languages: English, Chinese, Spanish, Japanese,
              German, French, Korean, Portuguese, Italian, Arabic, and Hindi. This covers approximately 4.5
              billion native speakers. The AI responds in the language of your query, making it accessible
              to a truly global audience.
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
              PDF.ai offers a limited free tier with a small number of queries per month. Paid plans provide
              additional capacity. Pricing details have changed over time and may not be consistently listed
              on their website.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk has transparent, predictable pricing. The free tier includes 500 credits per month plus
              a{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                no-signup demo
              </Link>. Plus ($9.99/month) includes 3,000 credits with Thorough mode and export. Pro
              ($19.99/month) includes 9,000 credits with custom instructions. Credit packs are available for
              one-time top-ups. View{' '}
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
              PDF.ai provides standard response times for basic PDF queries. The simple architecture means
              there is little overhead, though the lack of model options means you cannot optimize for
              different use cases.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers three AI performance modes. Quick mode (DeepSeek V3.2) is optimized for speed.
              Balanced mode (Mistral Medium) provides the best accuracy-speed tradeoff. Thorough mode
              (Mistral Large) delivers the most detailed analysis. This flexibility allows you to match the
              AI capability to each question.
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
              PDF.ai offers basic security measures for uploaded documents. Detailed security documentation
              is limited, making it difficult to assess the exact protections in place.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk implements comprehensive security: SSE-S3 encryption for all uploaded documents,
              SSRF protection for URL ingestion, magic-byte file validation, GDPR data export, cookie
              consent management, non-root Docker deployment, and structured security logging. Documents
              are never used for AI training.
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
                <span>Users who need citation highlighting to verify AI answers against source text</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>People working with any document format beyond PDF</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Non-English speakers who need a localized interface</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Users who want an actively developed tool with regular improvements</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Anyone who values transparent pricing and security documentation</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose PDF.ai? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            Who Should Choose PDF.ai?
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Users who only work with PDFs and need the most basic chat functionality</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>People who prefer the simplest possible interface with no learning curve</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Casual users with very occasional PDF question needs</span>
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
              PDF.ai pioneered a simple approach to AI PDF chat but has not kept pace with the evolving
              market. The tool remains functional for basic PDF questions, but the lack of citation
              highlighting, multi-format support, and multilingual capabilities leaves it behind newer
              alternatives.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              DocTalk offers substantially more value at every level. Seven-format support eliminates
              conversion headaches. Real-time citation highlighting provides answer verification that
              PDF.ai simply does not have. Eleven interface languages make it globally accessible. Active
              development means the tool continues to improve.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              For virtually all use cases, DocTalk is the better choice over PDF.ai in 2026.{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Try the free demo
              </Link>{' '}
              to experience the difference firsthand.
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
          description="Upload a document and see the difference. Citation highlighting, 7 formats, 11 languages."
          buttonText="Try the Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
