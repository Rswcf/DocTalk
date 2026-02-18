"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  GraduationCap,
  BookOpen,
  FileText,
  Globe,
  Search,
  Quote,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

const faqItems = [
  {
    question: 'Can DocTalk summarize a research paper?',
    answer:
      'Yes. Upload any research paper as a PDF, DOCX, or URL, then ask DocTalk to summarize it. The AI will generate a concise summary with numbered citations pointing to specific passages in the paper, so you can verify every key claim against the original text.',
  },
  {
    question: 'Does it work with arXiv papers?',
    answer:
      'Yes. You can paste an arXiv PDF URL directly into DocTalk, or download the PDF and upload it. DocTalk processes the full text including abstracts, methodology sections, results, and references. It works with papers from arXiv, PubMed, IEEE Xplore, JSTOR, Google Scholar, and any other academic repository.',
  },
  {
    question: 'How accurate is AI for academic research?',
    answer:
      'DocTalk uses Retrieval-Augmented Generation (RAG) to ground every answer in your actual document text. The AI only sees relevant passages retrieved from your paper, not general knowledge. Every answer includes numbered citations so you can verify claims against the source.',
  },
  {
    question: 'Is there a student discount?',
    answer:
      'DocTalk offers a generous free tier with 500 credits per month, which is enough for regular academic use. You can also try the instant demo with no signup at all. The Plus plan at $9.99/month and Pro plan at $19.99/month are available for heavy users.',
  },
  {
    question: 'Can I upload URLs to papers?',
    answer:
      'Yes. DocTalk supports URL ingestion, so you can paste a link to any publicly accessible paper or web page. DocTalk will fetch the content, extract the text, and let you chat with it just like an uploaded file.',
  },
];

export default function StudentsClient() {
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
            <span className="text-zinc-900 dark:text-zinc-100">Students & Academics</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            AI-Powered Research Paper Analysis for Students and Academics
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
            Upload research papers, textbooks, or dissertations and get AI-powered answers with page-level citations you can verify. Spend less time reading and more time understanding.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Analyze Your First Paper Free
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The Academic Reading Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              The Academic Reading Challenge
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Academic research demands an enormous volume of reading. A typical PhD student reads over 100 papers per year, and that number climbs sharply during literature review phases. Each paper averages 20 to 50 pages of dense, technical prose. Manually reviewing a single paper takes one to three hours, depending on the subject complexity and your familiarity with the field.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                The challenge extends beyond sheer volume. Researchers need to extract specific data points from papers: methodology details, statistical results, key findings, and how those findings relate to other work in the field. Skimming is risky because missing a critical caveat in a methodology section can undermine an entire literature review.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Undergraduate students face a different but related challenge. They are often assigned textbook chapters, supplementary readings, and academic articles on topics they are still learning. Without deep domain expertise, parsing academic language is slow and frustrating. Exam preparation compounds the pressure, requiring rapid comprehension across multiple chapters and papers.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Traditional AI chatbots can help with general questions, but they have a critical flaw for academic work: they generate answers from training data, not from your specific document. If an AI hallucinates a statistic or misquotes a finding, and you include it in your paper, your credibility is at stake. Academic research requires verifiable, source-grounded answers.
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps Researchers */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            How DocTalk Helps Researchers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Search,
                title: 'Summarize Papers Instantly',
                description: 'Upload a 50-page paper and ask "What are the key findings?" DocTalk returns a structured summary with numbered citations pointing to the exact paragraphs where each finding is stated. What used to take an hour takes seconds.',
              },
              {
                icon: BookOpen,
                title: 'Extract Methodologies',
                description: 'Ask "What research method did this study use?" or "Describe the experimental design." DocTalk identifies methodology sections and extracts detailed descriptions, including sample sizes, variables, and statistical approaches.',
              },
              {
                icon: FileText,
                title: 'Accelerate Literature Reviews',
                description: 'Upload papers one by one and ask comparison questions across them. "What were the main conclusions?" and "How does this methodology differ from the previous paper?" Build your literature review with verified source citations.',
              },
              {
                icon: GraduationCap,
                title: 'Prepare for Exams',
                description: 'Upload textbook chapters and ask practice questions. "What are the key concepts in chapter 3?" or "Explain the difference between Type I and Type II errors." Every answer points back to the textbook passage for review.',
              },
              {
                icon: Quote,
                title: 'Find Quotes and Page Numbers',
                description: 'Need to cite a specific passage in your thesis? Ask DocTalk to locate it. "Where does the author discuss limitations of the study?" The AI pinpoints the passage and gives you the page number for your citation.',
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

        {/* Supported Academic Document Types */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Supported Academic Document Types
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              DocTalk supports{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                7 document formats
              </Link>
              , covering virtually every type of academic material you encounter in research.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { format: 'PDF Research Papers', detail: 'Papers from arXiv, PubMed, IEEE Xplore, JSTOR, Springer, Elsevier, and any other repository. Handles multi-column layouts, equations, and tables.' },
                { format: 'DOCX Theses & Dissertations', detail: 'Word documents including draft theses, dissertation chapters, and advisor feedback documents. Preserves formatting context for accurate citation.' },
                { format: 'PPTX Lecture Slides', detail: 'PowerPoint presentations from lectures, conference talks, and seminar presentations. Extract content from slide text and speaker notes.' },
                { format: 'URLs from Academic Repositories', detail: 'Paste a link to any publicly accessible paper, preprint, or academic web page. DocTalk fetches and processes the content automatically.' },
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

        {/* Real-World Academic Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            Real-World Academic Use Cases
          </h2>

          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Analyzing a 50-Page Thesis
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                A graduate student uploads their advisor&apos;s recommended reading, a 50-page thesis on machine learning interpretability. Instead of reading end to end, they ask: &quot;What are the main conclusions of this thesis?&quot; DocTalk returns a four-point summary, each point linked to a numbered citation. Clicking citation [1] scrolls to page 42 where the author states their primary finding. Clicking [3] jumps to page 47 where the author discusses implications. The student grasps the thesis&apos;s core argument in two minutes.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Follow-up questions drill deeper: &quot;What datasets were used in the experiments?&quot; reveals the exact section describing the experimental setup. &quot;What limitations does the author acknowledge?&quot; surfaces the limitations discussion from the final chapter. Each answer is traceable to a specific page.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Building a Literature Review from 10 Papers
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                A doctoral candidate working on a literature review about natural language processing in healthcare uploads ten papers sequentially. For each paper, they ask: &quot;What are the main findings?&quot; and &quot;What methodology was used?&quot; They compile the cited answers into a structured comparison matrix, with each finding traceable to its source paper and page number.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                This workflow replaces the traditional approach of reading each paper cover to cover, taking handwritten notes, and manually organizing findings. The citations make it trivial to go back and verify any point during the writing process. When the advisor asks &quot;where did you find that claim about BERT performance,&quot; the student can point to the exact page in the exact paper.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Understanding Complex Methodology Sections
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                Methodology sections are often the most challenging part of a research paper, especially for students new to a field. A statistics student uploads a paper that uses Bayesian hierarchical modeling and asks: &quot;Explain the statistical methods used in this study in simple terms.&quot; DocTalk breaks down the methodology, citing the specific paragraphs where each technique is described.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                The student can then ask follow-up questions: &quot;What were the prior distributions?&quot; or &quot;How was model convergence assessed?&quot; Each answer points back to the methodology section, allowing the student to read the original technical language alongside the AI&apos;s plain-language explanation.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Exam Preparation with Textbook Q&amp;A
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                An undergraduate student facing a midterm uploads three textbook chapters as PDFs. They use DocTalk as a study partner, asking questions like: &quot;What are the key concepts in chapter 3?&quot;, &quot;Explain the difference between monetary and fiscal policy,&quot; and &quot;What examples does the textbook give for market failure?&quot;
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Every answer includes citations that point back to the textbook pages. When the student encounters a concept they do not fully understand, they click the citation to read the original textbook explanation. This creates an active learning loop that is far more effective than passive re-reading.
              </p>
            </div>
          </div>
        </section>

        {/* Why Citations Matter for Academic Work */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              Why Citations Matter for Academic Work
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              The rise of AI tools in academia has brought a serious problem: hallucination. General-purpose AI chatbots generate answers from their training data, not from the specific document you are studying. They may present fabricated statistics, misattribute findings to the wrong authors, or invent citations that do not exist. In academic work, where every claim must be verifiable, this is unacceptable.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              You cannot write in a research paper that &quot;an AI said so.&quot; Every claim needs a traceable source. DocTalk&apos;s{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                citation highlighting system
              </Link>{' '}
              solves this by grounding every AI answer in your actual document text. Each numbered citation corresponds to a specific passage in your uploaded paper. Click the citation, and the document viewer scrolls to the exact text and highlights it.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              This means DocTalk is not a replacement for reading. It is an accelerator. It helps you find the right passages faster, understand complex sections more quickly, and verify every claim before you include it in your own work. The AI acts as a research assistant that always shows its sources.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              For students concerned about academic integrity, this distinction is crucial. Using DocTalk to locate and understand source material in a paper you have legitimately accessed is no different from using a search function or index. The tool helps you find information; the understanding and analysis remain yours.
            </p>
          </div>
        </section>

        {/* Multilingual Academic Research */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                Multilingual Academic Research
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                Academic research is a global endeavor. Groundbreaking papers are published in Chinese, Japanese, German, Spanish, and dozens of other languages. A researcher studying manufacturing techniques may need to review Japanese engineering papers. A historian might analyze German-language primary sources. A medical researcher could encounter Chinese clinical trials.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                DocTalk supports{' '}
                <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  11 interface languages
                </Link>{' '}
                and can analyze documents written in any language. Upload a paper in Chinese, ask questions in English, and get answers in English with citations pointing to the Chinese source text. This breaks down language barriers that have historically limited cross-cultural academic collaboration.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                The citation system works across languages. When DocTalk cites a passage from a Japanese paper, clicking the citation highlights the original Japanese text in the document viewer. You can verify the AI&apos;s interpretation against the source, even if you are not fully fluent in the document&apos;s language.
              </p>
            </div>
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
                  title: 'Upload Your Paper',
                  description: 'Drag and drop a PDF, DOCX, or PPTX file, or paste a URL to any publicly accessible paper. DocTalk extracts and indexes the full text in seconds.',
                },
                {
                  icon: MessageSquare,
                  step: '2',
                  title: 'Ask a Question',
                  description: 'Type any question in natural language. "What are the key findings?" or "Explain the methodology." DocTalk retrieves the most relevant passages and generates an answer.',
                },
                {
                  icon: CheckCircle,
                  step: '3',
                  title: 'Verify the Citation',
                  description: 'Click any numbered citation in the AI answer. The document viewer scrolls to the exact source passage and highlights it, so you can verify the claim before using it in your work.',
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
              Start Analyzing Papers — Free, No Signup
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-xl mx-auto">
              Try DocTalk&apos;s free demo with sample documents. See how AI-powered citation highlighting works on real papers. No account required.
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
