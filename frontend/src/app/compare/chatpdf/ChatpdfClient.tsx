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
  { name: 'Interface Languages', doctalk: '11 languages', competitor: 'English-focused' },
  { name: 'Free Tier', doctalk: '500 credits/mo + instant demo', competitor: '2 PDFs/day, 3 questions each' },
  { name: 'No-Signup Demo', doctalk: true, competitor: false },
  { name: 'Multiple AI Models', doctalk: '3 performance modes', competitor: 'Single model' },
  { name: 'Document Size Limit', doctalk: 'Up to 100 MB (Pro)', competitor: '32 MB' },
  { name: 'Dark Mode', doctalk: true, competitor: false },
  { name: 'Web URL Ingestion', doctalk: true, competitor: false },
  { name: 'Custom Instructions', doctalk: 'Pro plan', competitor: false },
];

const faqItems = [
  {
    question: 'Is DocTalk better than ChatPDF?',
    answer: 'DocTalk supports 7 document formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) while ChatPDF only supports PDF. DocTalk also provides real-time citation highlighting that shows you exactly where in the document each answer comes from, a feature ChatPDF lacks. However, ChatPDF has been around longer and has a larger user base.',
  },
  {
    question: 'Does ChatPDF have citation highlighting?',
    answer: 'ChatPDF mentions page numbers in its answers but does not offer inline citation highlighting. DocTalk provides real-time citation highlighting that visually highlights the exact passage in your document when you click a citation, making it much easier to verify AI answers.',
  },
  {
    question: 'Can I use DocTalk for free?',
    answer: 'Yes. DocTalk offers an instant demo that requires no signup at all, plus a free tier with 500 credits per month after you create an account. ChatPDF offers a free tier limited to 2 PDFs per day with 3 questions each.',
  },
  {
    question: 'Which tool supports more languages?',
    answer: 'DocTalk supports 11 interface languages (English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi) and can analyze documents in any language. ChatPDF is primarily English-focused with limited multilingual support.',
  },
  {
    question: 'Can DocTalk handle Word and PowerPoint files?',
    answer: 'Yes. DocTalk natively supports PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. ChatPDF only processes PDF files, so you would need to convert other formats to PDF first.',
  },
];

export default function ChatpdfClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">DocTalk vs ChatPDF</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            DocTalk vs ChatPDF: Full Comparison (2026)
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Both DocTalk and ChatPDF let you chat with documents using AI, but they take different approaches.
            ChatPDF focuses exclusively on PDFs with a simple interface, while DocTalk supports seven document
            formats and provides real-time citation highlighting so you can verify every answer against the
            original source. Here is how they compare across features, pricing, and performance.
          </p>
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              Quick Comparison
            </h2>
            <ComparisonTable features={features} competitorName="ChatPDF" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            What Is DocTalk?
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            DocTalk is an AI-powered document question-and-answer platform that supports seven file formats:
            PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Upload any document, ask questions in natural
            language, and receive answers with real-time citation highlighting that scrolls to and visually
            highlights the exact source passage in your original document. The interface supports 11 languages,
            offers three AI performance modes (Quick, Balanced, and Thorough), and includes a free demo that
            requires no account creation. DocTalk is designed for students, researchers, legal professionals,
            and anyone who needs to extract information from documents quickly while maintaining full
            traceability to the source material.
          </p>
        </section>

        {/* What Is ChatPDF? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              What Is ChatPDF?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              ChatPDF is one of the earliest AI PDF chat tools, launched in early 2023. It allows users to
              upload PDF files and ask questions about their contents using a conversational interface. The tool
              references page numbers in its answers, making it possible to locate information manually.
              ChatPDF has built a large user base thanks to its simplicity and early-mover advantage. The free
              tier allows 2 PDFs per day with 3 questions each, while the Plus plan ($19.99/month) removes
              these limits. ChatPDF focuses solely on PDF files and does not support other document formats
              like Word, PowerPoint, or Excel.
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
              This is the most significant difference between the two tools. ChatPDF supports only PDF files.
              If you need to analyze a Word document, a PowerPoint presentation, an Excel spreadsheet, or a
              web page, you must first convert it to PDF before uploading, which is inconvenient and can
              introduce formatting issues.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk natively supports seven formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs.
              Each format is parsed with a dedicated extractor that preserves the document structure, including
              tables, headings, and paragraph breaks. For example, the XLSX parser preserves spreadsheet
              structure, and the PPTX parser maintains slide order with speaker notes. This means you can
              upload your files directly without any conversion step, and the AI receives clean, structured
              text that produces better answers. See our{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                multi-format support
              </Link>{' '}
              page for details.
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
              Both tools use retrieval-augmented generation (RAG) to answer questions based on your document
              content. ChatPDF provides page number references in its responses, which helps you know roughly
              where to look. However, you need to manually scroll to the referenced page and search for the
              relevant passage yourself.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk takes citations significantly further with real-time citation highlighting. When the AI
              answers your question, each citation is a clickable link. Clicking it instantly scrolls the
              document viewer to the exact passage and visually highlights it, allowing you to verify the
              answer in seconds without any manual searching. This feature is particularly valuable for
              academic research, legal document review, and any task where accuracy matters. Learn more about
              our{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                citation system
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
              ChatPDF has a primarily English interface with limited multilingual capability. While the
              underlying AI models can process text in multiple languages, the interface, help documentation,
              and user experience are centered around English speakers.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk provides a fully localized interface in 11 languages: English, Chinese, Spanish,
              Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Every element of the
              interface, from buttons and labels to error messages and billing pages, is translated. The AI
              can also respond in the same language as your question, regardless of the document language.
              This makes DocTalk a strong choice for multilingual teams and non-English speakers. See our{' '}
              <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                multilingual support
              </Link>{' '}
              page.
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
              ChatPDF offers a free tier limited to 2 PDFs per day with 3 questions each and a maximum file
              size of 10 MB. The Plus plan costs $19.99 per month and includes 50 PDFs per day, 50 questions
              per PDF, and a 32 MB file size limit.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk takes a different approach. First, there is an{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">instant demo</Link>{' '}
              that requires absolutely no signup, so you can try the product before creating an account. The
              free tier includes 500 credits per month. The Plus plan ($9.99/month) includes 3,000 credits
              and unlocks Thorough mode and export features. The Pro plan ($19.99/month) adds 9,000 credits
              and custom instructions. DocTalk is generally more affordable: the Plus plan at $9.99 offers
              comparable or better value than ChatPDF Plus at $19.99. View{' '}
              <Link href="/billing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                full pricing details
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
              ChatPDF uses a single AI model for all users and generally provides responses within a few
              seconds. The simplicity of its architecture, focused solely on PDF, means parsing is
              straightforward.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk offers three performance modes. Quick mode (powered by DeepSeek V3.2) delivers fast
              responses ideal for simple questions. Balanced mode (Mistral Medium) provides higher accuracy
              for nuanced questions. Thorough mode (Mistral Large) gives the most detailed analysis for
              complex research tasks. This flexibility lets you choose the right speed-quality tradeoff for
              each question. Document parsing uses dedicated Celery workers that process files asynchronously,
              so uploading and parsing happens in the background while you can start reviewing the document.
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
              ChatPDF states that documents are stored securely and can be deleted by the user. The privacy
              policy covers basic data handling practices.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              DocTalk implements SSE-S3 encryption for all uploaded documents, SSRF protection for URL
              ingestion, magic-byte file validation to prevent malicious uploads, and structured security
              event logging. Documents are never used to train AI models. DocTalk also provides a GDPR data
              export endpoint and cookie consent management. The OAuth implementation strips tokens after
              linking, and the Docker deployment runs as a non-root user for defense in depth.
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
                <span>Users who work with multiple document formats (Word, PowerPoint, Excel) and want to avoid converting everything to PDF</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Researchers and legal professionals who need verifiable citations with one-click source highlighting</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Non-English speakers who need a fully localized interface in their language</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Budget-conscious users who want premium features at a lower price point ($9.99 vs $19.99)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>Users who want to try before committing, using the no-signup instant demo</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose ChatPDF? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            Who Should Choose ChatPDF?
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Users who exclusively work with PDF files and do not need other format support</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>People who prefer an established tool with a large community and proven track record</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Users who need the simplest possible interface with minimal learning curve</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Casual users who only need to ask a few questions occasionally (2 free PDFs per day may suffice)</span>
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
              ChatPDF pioneered the AI PDF chat category and remains a solid choice for users who only work
              with PDF files and want a simple, proven interface. Its large user base and early-mover
              advantage give it brand recognition.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              However, DocTalk offers a more comprehensive solution. The support for seven document formats
              eliminates the need for file conversion. Real-time citation highlighting provides a level of
              answer verification that ChatPDF does not match. The 11-language interface makes DocTalk
              accessible to a global audience. And at $9.99 per month for the Plus plan versus ChatPDF
              Plus at $19.99, DocTalk delivers more features for less money.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              For most users, especially those who work with mixed document formats or need citation
              verification, DocTalk is the stronger choice. The best way to decide is to{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                try the free demo
              </Link>{' '}
              and see the citation highlighting in action.
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
                { href: '/features/multilingual', label: 'Multilingual' },
                { href: '/demo', label: 'Free Demo' },
                { href: '/billing', label: 'Pricing' },
                { href: '/alternatives/chatpdf', label: 'ChatPDF Alternatives' },
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
          description="Upload a document and see citation highlighting in action. No account needed."
          buttonText="Try the Demo"
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
