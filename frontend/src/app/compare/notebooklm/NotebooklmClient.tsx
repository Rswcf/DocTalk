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
  { name: 'Supported Formats', doctalk: '7 (PDF, DOCX, PPTX, XLSX, TXT, MD, URL)', competitor: 'PDF, Google Docs, web URLs, text, YouTube' },
  { name: 'Citation Highlighting', doctalk: 'Real-time visual highlighting', competitor: 'Inline source references' },
  { name: 'Multi-Source Notebooks', doctalk: false, competitor: true },
  { name: 'Audio Podcast Generation', doctalk: false, competitor: true },
  { name: 'Interface Languages', doctalk: '11 languages', competitor: 'English primary' },
  { name: 'Requires Google Account', doctalk: false, competitor: true },
  { name: 'No-Signup Demo', doctalk: true, competitor: false },
  { name: 'Free Tier', doctalk: '500 credits/mo', competitor: 'Free (Google account required)' },
  { name: 'Multiple AI Modes', doctalk: '3 performance modes', competitor: 'Gemini only' },
  { name: 'Data Encryption', doctalk: 'SSE-S3', competitor: 'Google standard' },
];

const faqItems = [
  {
    question: 'Is DocTalk better than NotebookLM?',
    answer: 'DocTalk and NotebookLM serve different purposes. DocTalk excels at single-document deep analysis with real-time citation highlighting, 7 format support, and 11 languages. NotebookLM is better for multi-source notebooks and offers unique AI-generated audio podcasts. DocTalk is the better choice if you need citation verification and format flexibility; NotebookLM is better for free multi-source research.',
  },
  {
    question: 'Is NotebookLM really free?',
    answer: 'Yes, Google NotebookLM is currently free to use, though it requires a Google account. Google has not yet announced pricing for future premium features. However, being free means you are subject to Google data practices and potential changes in service terms.',
  },
  {
    question: 'Does NotebookLM support citation highlighting?',
    answer: 'NotebookLM shows inline citations that link to the source document within the notebook. However, it does not provide the real-time visual highlighting that DocTalk offers, where clicking a citation scrolls to and highlights the exact passage in a document viewer alongside the chat.',
  },
  {
    question: 'Can I use DocTalk without a Google account?',
    answer: 'Yes. DocTalk supports Google OAuth, Microsoft OAuth, and email magic links for authentication. You can also use the instant demo with no account at all. NotebookLM requires a Google account, which may be a concern for users who prefer not to use Google services.',
  },
  {
    question: 'Which tool is more private?',
    answer: 'DocTalk stores documents with SSE-S3 encryption, never trains AI on your data, and provides GDPR data export. NotebookLM is a Google product subject to Google privacy policies. DocTalk gives you more control and transparency over your data.',
  },
];

export default function NotebooklmClient() {
  return (
    <>
      <Header variant="minimal" />
      <main className="min-h-screen bg-white dark:bg-zinc-950">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/compare" className="hover:text-zinc-700 dark:hover:text-zinc-300">Compare</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">DocTalk vs NotebookLM</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            DocTalk vs NotebookLM: Which AI Document Tool?
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Google NotebookLM and DocTalk represent two different philosophies in AI document analysis.
            NotebookLM is a free, Google-integrated tool built around multi-source notebooks with a unique
            audio podcast feature. DocTalk is an independent, privacy-first platform focused on deep
            single-document analysis with real-time citation highlighting across seven formats and eleven
            languages. Here is how they compare in detail.
          </p>
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
              Quick Comparison
            </h2>
            <ComparisonTable features={features} competitorName="NotebookLM" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            What Is DocTalk?
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            DocTalk is an independent AI document Q&A platform designed for deep, verifiable analysis of
            individual documents. It supports seven file formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown,
            and web URLs) and provides real-time citation highlighting: click any citation in an AI answer
            to instantly scroll to and highlight the exact source passage in a side-by-side document viewer.
            The interface is fully localized in 11 languages. Three AI performance modes (Quick, Balanced,
            Thorough) let you choose between speed and depth. DocTalk requires no vendor lock-in. You can
            sign in with Google, Microsoft, or email, and your data is encrypted and never used for AI training.
          </p>
        </section>

        {/* What Is NotebookLM? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              What Is NotebookLM?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Google NotebookLM (formerly Project Tailwind) is a free AI-powered research tool that lets you
              create notebooks with multiple source documents. You can upload PDFs, link Google Docs, paste
              text, and add web URLs or YouTube videos as sources. The AI synthesizes information across all
              sources in a notebook, making it useful for literature reviews and research projects. NotebookLM
              is unique in offering AI-generated audio podcasts that summarize your sources as a natural-sounding
              conversation. It runs on Google Gemini and is deeply integrated with the Google ecosystem. A
              Google account is required.
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-10">
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
              NotebookLM supports PDF files, Google Docs (natively via Drive), web URLs, pasted text, and
              YouTube video transcripts. It does not natively support DOCX, PPTX, or XLSX files, though you
              can upload Word documents to Google Drive and convert them. The YouTube integration is a unique
              strength for video-based research.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk directly accepts PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs with dedicated
              parsers for each format. The XLSX parser preserves spreadsheet structure, and the PPTX parser
              maintains slide order with speaker notes. No conversion step is needed. While DocTalk does not
              support YouTube or Google Docs integration, it covers the most common business and academic
              document formats. See{' '}
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
              NotebookLM provides inline citations numbered with source references. Clicking a citation
              highlights the relevant source in the notebook sidebar. The multi-source approach means answers
              can synthesize information from multiple documents, which is powerful for cross-referencing. The
              AI podcast feature creates engaging audio summaries, though it cannot replace detailed Q&A.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk provides real-time citation highlighting in a dedicated side-by-side document viewer.
              Click any citation and the viewer scrolls to the exact passage with a visual highlight overlay.
              This is particularly effective for PDF documents where bounding-box coordinates enable precise
              highlighting. While DocTalk focuses on single-document analysis rather than multi-source
              synthesis, it provides deeper, more precise citations for individual documents. Learn more
              about{' '}
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
              NotebookLM has a primarily English interface, though Gemini can process and respond in multiple
              languages. The audio podcast feature currently works best in English. The Google ecosystem
              provides some inherent multilingual support, but the NotebookLM interface itself is not fully
              localized.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers a fully localized interface in 11 languages: English, Chinese, Spanish, Japanese,
              German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Every interface element is
              translated, and the AI responds in the language of your question. This makes DocTalk the
              stronger choice for multilingual teams. See{' '}
              <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                multilingual support
              </Link>.
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
              NotebookLM is currently free. This is its biggest advantage. Google has not disclosed future
              pricing, but as with many Google products, it may remain free with usage limits while offering
              premium features at a cost. The tradeoff is that you are building your workflow inside Google
              ecosystem.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers a{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">free demo</Link>{' '}
              with no signup required, plus 500 free credits per month. Paid plans start at $9.99/month (Plus)
              for 3,000 credits and go up to $19.99/month (Pro) for 9,000 credits with advanced features. While
              not free like NotebookLM, DocTalk provides transparent, predictable pricing without vendor lock-in.
              View{' '}
              <Link href="/billing" className="text-indigo-600 dark:text-indigo-400 hover:underline">pricing</Link>.
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
              NotebookLM runs on Google Gemini and benefits from Google infrastructure. Responses are generally
              fast, though processing multiple large sources in a notebook can take time. The audio podcast
              generation is a longer process, typically taking a minute or more to produce.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers three performance modes. Quick mode (DeepSeek V3.2) provides the fastest responses.
              Balanced mode (Mistral Medium) is ideal for most questions. Thorough mode (Mistral Large) delivers
              the most comprehensive analysis. This flexibility is unavailable in NotebookLM, which is locked
              to Gemini.
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
              NotebookLM is subject to Google privacy policies. While Google states that NotebookLM does not
              use your data for training, it is still within the Google ecosystem, and your documents are
              stored on Google servers. This may be a concern for organizations with strict data governance
              requirements or those who prefer not to centralize data with a single tech company.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk is an independent platform with SSE-S3 encryption, SSRF protection, and GDPR compliance
              features. Documents are never used for AI training. You can export all your data at any time, and
              the platform supports multiple authentication providers (Google, Microsoft, email) to avoid vendor
              lock-in. For organizations that need data sovereignty or want to avoid Google dependency, DocTalk
              is the more private choice.
            </p>
          </div>
        </section>

        {/* Who Should Choose DocTalk? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              Who Should Choose DocTalk?
            </h2>
            <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Users who need precise citation highlighting to verify AI answers against source text</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>People working with DOCX, PPTX, or XLSX files that NotebookLM does not natively support</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Non-English speakers who need a fully localized interface in their language</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Organizations that need to avoid Google vendor lock-in or have strict data governance requirements</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Users who want to choose between multiple AI models for different tasks</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose NotebookLM? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            Who Should Choose NotebookLM?
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Researchers who need to synthesize information across multiple documents simultaneously</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Users who want AI-generated audio podcasts summarizing their research</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>People deeply embedded in the Google ecosystem (Drive, Docs, YouTube)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Budget-conscious users who need a completely free tool</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Students working on literature reviews who need cross-document synthesis</span>
            </li>
          </ul>
        </section>

        {/* Verdict */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              Verdict
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              NotebookLM and DocTalk solve different problems. NotebookLM excels at multi-source research
              with its notebook paradigm and the unique audio podcast feature. Being free and backed by Google
              infrastructure makes it a compelling choice for students and researchers who are comfortable
              within the Google ecosystem.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              DocTalk excels at deep, verifiable single-document analysis. The real-time citation highlighting
              is in a class of its own for answer verification. Support for seven document formats (including
              DOCX, PPTX, and XLSX that NotebookLM lacks) and 11 interface languages makes it more versatile
              for professional and international use cases. The independence from any single tech platform is
              a real advantage for organizations concerned about vendor lock-in.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              If you primarily need multi-source synthesis and love Google products, NotebookLM is excellent.
              If you need precise citation verification, work with business document formats, or want to
              avoid Google dependency,{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                try DocTalk
              </Link>{' '}
              for free.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
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
                { href: '/features/multilingual', label: 'Multilingual' },
                { href: '/demo', label: 'Free Demo' },
                { href: '/alternatives/notebooklm', label: 'NotebookLM Alternatives' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <CTABanner
          title="Try DocTalk Free — No Signup Required"
          description="No Google account needed. Upload a document and experience citation highlighting instantly."
          buttonText="Try the Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </>
  );
}
