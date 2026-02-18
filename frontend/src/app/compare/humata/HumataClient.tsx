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
  { name: 'Supported Formats', doctalk: '7 (PDF, DOCX, PPTX, XLSX, TXT, MD, URL)', competitor: 'PDF, Word, video files' },
  { name: 'Citation Highlighting', doctalk: true, competitor: false },
  { name: 'Video File Support', doctalk: false, competitor: true },
  { name: 'Team Collaboration', doctalk: false, competitor: true },
  { name: 'Interface Languages', doctalk: '11 languages', competitor: 'English only' },
  { name: 'No-Signup Demo', doctalk: true, competitor: false },
  { name: 'Free Tier', doctalk: '500 credits/mo', competitor: '60 pages/mo' },
  { name: 'Multiple AI Modes', doctalk: '3 performance modes', competitor: 'Single model' },
  { name: 'Starting Paid Price', doctalk: '$9.99/mo', competitor: '$4.99/mo (100 pages)' },
  { name: 'Dark Mode', doctalk: true, competitor: false },
];

const faqItems = [
  {
    question: 'Is DocTalk cheaper than Humata?',
    answer: 'Yes. DocTalk Plus costs $9.99/month with 3,000 credits, while Humata Student costs $4.99/month with only 100 pages/month, and Humata Expert costs $14.99/month. For most users, DocTalk provides better value per dollar with more generous usage limits and citation highlighting included at every tier.',
  },
  {
    question: 'Does Humata have citation highlighting?',
    answer: 'Humata provides page references in its answers but does not offer real-time inline citation highlighting. DocTalk lets you click any citation to instantly scroll to and highlight the exact passage in your document viewer.',
  },
  {
    question: 'Which tool is better for teams?',
    answer: 'Humata has an edge for team collaboration with shared workspaces and team management features on its Team plan ($49/user/month). DocTalk is currently focused on individual users, making it the better choice for personal document analysis.',
  },
  {
    question: 'Can Humata process video files?',
    answer: 'Yes, Humata supports video file analysis, which is a unique feature. DocTalk does not support video files but handles 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with real-time citation highlighting.',
  },
];

export default function HumataClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">DocTalk vs Humata</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            DocTalk vs Humata: AI Document Tool Comparison
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Humata and DocTalk both offer AI-powered document analysis, but they target different audiences.
            Humata focuses on team collaboration and offers unique video file support, while DocTalk provides
            real-time citation highlighting, seven document formats, and a fully multilingual interface at a
            more affordable price point. Here is how they stack up across every important dimension.
          </p>
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
              Quick Comparison
            </h2>
            <ComparisonTable features={features} competitorName="Humata" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            What Is DocTalk?
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            DocTalk is an AI document Q&A platform built for verifiable answers. Upload documents in seven
            formats (PDF, DOCX, PPTX, XLSX, TXT, Markdown, or web URL), ask questions, and receive answers
            with real-time citation highlighting. Click any citation to scroll directly to the source passage
            with a visual highlight. The interface is available in 11 languages. Three AI performance modes
            (Quick, Balanced, Thorough) let you optimize for speed or depth. A free demo requires no signup,
            and paid plans start at $9.99 per month. DocTalk is designed for individuals who need fast,
            accurate, and traceable document analysis.
          </p>
        </section>

        {/* What Is Humata? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              What Is Humata?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Humata is an AI document analysis platform launched in 2023 that has expanded from PDF analysis
              into a broader content tool. It supports PDF and Word documents, and notably also supports video
              file analysis. Humata offers a free tier with 60 pages per month, a Student plan at $4.99/month
              (100 pages), an Expert plan at $14.99/month (500 pages), and a Team plan at $49/user/month with
              collaboration features. The team collaboration functionality, including shared workspaces and
              role management, sets it apart from individual-focused tools. Humata positions itself as a
              tool for students, researchers, and professional teams working with dense documents.
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
              Humata supports PDF, Word documents, and video files. The video support is a unique differentiator
              that no other tool in this comparison category offers. However, Humata does not support
              PowerPoint, Excel, or web URL ingestion, which limits its usefulness for business analysts
              working with spreadsheets or presentations.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk supports seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Each
              format has a dedicated parser that preserves structure. The XLSX parser maintains spreadsheet
              cell relationships, the PPTX parser preserves slide order and speaker notes, and the URL
              ingester extracts clean article content from web pages. While DocTalk does not support video,
              it covers the broadest range of common document formats. See{' '}
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
              Humata provides page number references in its answers. The AI generates competent responses for
              most document types, with a clean interface for viewing answers. The focus on team collaboration
              means that answers can be shared and discussed within a workspace.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk provides real-time citation highlighting. Every citation in an AI answer is clickable:
              click it and the document viewer scrolls to the exact passage with a visual highlight overlay.
              For PDF documents, this uses bounding-box coordinates for pixel-perfect highlighting. For other
              formats, it uses text-snippet matching. This instant verification eliminates the need to manually
              search for sources, saving significant time for researchers and professionals. Learn more about{' '}
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
              Humata has an English-only interface. While the AI can process documents in other languages,
              the entire application experience is in English. This is a notable limitation for international
              teams or non-English-speaking individuals.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers a fully localized interface in 11 languages. This includes English, Chinese,
              Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Every element
              from navigation to error messages to billing pages is translated. The AI also responds in the
              language of your question. See{' '}
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
              Humata offers a free tier with 60 pages per month. Paid plans include Student ($4.99/month,
              100 pages), Expert ($14.99/month, 500 pages), and Team ($49/user/month, unlimited pages with
              collaboration). The page-based pricing means costs scale with document length, which can be
              unpredictable for users working with long documents.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk uses a credit-based system that is more predictable. The free tier includes 500 credits
              per month plus a{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">no-signup demo</Link>.
              Plus ($9.99/month) includes 3,000 credits with Thorough mode and export. Pro ($19.99/month)
              includes 9,000 credits with custom instructions. Credits are consumed per question based on
              the AI mode used, not per document page. View{' '}
              <Link href="/billing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                pricing details
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
              Humata provides reasonable response times for most queries. Video processing takes longer due
              to the complexity of transcription and analysis. The tool handles long documents well, though
              very large files may require higher-tier plans.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers three AI modes. Quick mode (DeepSeek V3.2) delivers fast answers for lookups.
              Balanced mode (Mistral Medium) offers a good speed-quality tradeoff. Thorough mode (Mistral
              Large) provides the deepest analysis. Asynchronous parsing means documents are processed in
              the background, and you can start reviewing as soon as upload completes.
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
              Humata emphasizes security for its team features, with role-based access control on Team plans.
              Documents are stored securely, and the platform is SOC 2 compliant according to their marketing
              materials. Enterprise plans include additional security features.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL
              ingestion, magic-byte file validation, and GDPR compliance with data export. Documents are
              never used for AI training. The application runs in non-root Docker containers and uses
              structured security event logging for audit trails.
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
                <span>Individual users who need verifiable citations with one-click highlighting</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>People who work with PowerPoint, Excel, or web pages in addition to PDFs</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Non-English speakers who need a fully localized interface</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Budget-conscious users who want more features per dollar ($9.99 for 3,000 credits vs $14.99 for 500 pages)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Anyone who wants to try before committing via the instant no-signup demo</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose Humata? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            Who Should Choose Humata?
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Teams that need shared workspaces and collaborative document analysis</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Users who need to analyze video content alongside documents</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Students who need a very low-cost entry point ($4.99/month Student plan)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Enterprise organizations that need SOC 2 compliance and role-based access control</span>
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
              Humata has carved out a niche with team collaboration features and video support. For
              organizations that need shared document analysis with role management, the Team plan provides
              genuine value. The Student plan at $4.99/month is one of the cheapest entry points in this
              category, though the 100-page limit is restrictive.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              DocTalk offers superior citation highlighting, broader format support (seven formats vs three),
              11-language localization, and better value for individual users. The credit-based pricing is
              more predictable than page-based pricing, and the no-signup demo makes it the easiest to try.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              For individual users, researchers, and professionals, DocTalk is the stronger choice due to
              citation highlighting, format flexibility, and multilingual support. For teams needing
              collaboration features,{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                try DocTalk first
              </Link>{' '}
              to see if the individual features meet your needs before considering Humata Team.
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
                { href: '/features/multilingual', label: 'Multilingual' },
                { href: '/demo', label: 'Free Demo' },
                { href: '/billing', label: 'Pricing' },
                { href: '/alternatives/humata', label: 'Humata Alternatives' },
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
          description="See citation highlighting in action. Upload any document and start asking questions instantly."
          buttonText="Try the Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </>
  );
}
