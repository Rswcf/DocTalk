"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import {
  Languages,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const languages = [
  { flag: '\u{1F1FA}\u{1F1F8}', native: 'English', english: 'English', code: 'en' },
  { flag: '\u{1F1E8}\u{1F1F3}', native: '\u4E2D\u6587', english: 'Chinese', code: 'zh' },
  { flag: '\u{1F1EF}\u{1F1F5}', native: '\u65E5\u672C\u8A9E', english: 'Japanese', code: 'ja' },
  { flag: '\u{1F1EA}\u{1F1F8}', native: 'Espa\u00F1ol', english: 'Spanish', code: 'es' },
  { flag: '\u{1F1E9}\u{1F1EA}', native: 'Deutsch', english: 'German', code: 'de' },
  { flag: '\u{1F1EB}\u{1F1F7}', native: 'Fran\u00E7ais', english: 'French', code: 'fr' },
  { flag: '\u{1F1F0}\u{1F1F7}', native: '\uD55C\uAD6D\uC5B4', english: 'Korean', code: 'ko' },
  { flag: '\u{1F1E7}\u{1F1F7}', native: 'Portugu\u00EAs', english: 'Portuguese', code: 'pt' },
  { flag: '\u{1F1EE}\u{1F1F9}', native: 'Italiano', english: 'Italian', code: 'it' },
  { flag: '\u{1F1F8}\u{1F1E6}', native: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', english: 'Arabic', code: 'ar' },
  { flag: '\u{1F1EE}\u{1F1F3}', native: '\u0939\u093F\u0928\u094D\u0926\u0940', english: 'Hindi', code: 'hi' },
];

export default function MultilingualClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              <Languages className="w-4 h-4" />
              11 Languages
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              Chat with Documents in 11 Languages
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              Upload a document in any language. Ask questions in any language. Get answers in your
              preferred language. DocTalk&apos;s AI understands context across languages — including
              full CJK support for Chinese, Japanese, and Korean PDFs.
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

        {/* Supported Languages Grid */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              Supported Languages
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              Both the interface and the AI chat are fully available in all 11 languages. Switch
              anytime from the language selector in the header.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {languages.map((lang) => (
                <div
                  key={lang.code}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center"
                >
                  <span className="text-2xl mb-2 block" role="img" aria-label={lang.english + ' flag'}>
                    {lang.flag}
                  </span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    {lang.native}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {lang.english}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How Multilingual Chat Works */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              How Multilingual Chat Works
            </h2>
            <div className="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <p>
                DocTalk&apos;s multilingual support goes beyond simple translation. The AI models powering
                DocTalk — DeepSeek, Mistral Medium, and Mistral Large — are natively multilingual,
                trained on text in dozens of languages. They do not translate your question to English,
                process it, and translate back. They understand your language directly.
              </p>
              <p>
                When you upload a document, DocTalk extracts the text in its original language and
                indexes it for semantic search. When you ask a question, the semantic search operates
                across languages, finding relevant passages even if you ask in a different language
                than the document. The AI then generates an answer in your preferred language, with
                citations pointing back to the original text.
              </p>
              <p>
                The entire DocTalk interface — buttons, menus, labels, error messages, billing pages — is
                fully localized in all 11 languages. Switch languages anytime using the language
                selector in the header, and the entire application updates instantly.
              </p>
            </div>
          </div>
        </section>

        {/* Cross-Language Analysis */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              Cross-Language Analysis
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              Ask in one language about a document in another. DocTalk bridges the language gap.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  from: 'English question',
                  to: 'Chinese PDF',
                  example: 'Upload a Chinese research paper and ask questions in English. Get answers in English with citations pointing to the original Chinese text.',
                },
                {
                  from: 'Japanese question',
                  to: 'English report',
                  example: 'Upload an English financial report and ask questions in Japanese. The AI responds in Japanese, citing the original English passages.',
                },
                {
                  from: 'Spanish question',
                  to: 'German contract',
                  example: 'Upload a German legal contract and ask questions in Spanish. Navigate to the source clauses in the original German document.',
                },
                {
                  from: 'Korean question',
                  to: 'French presentation',
                  example: 'Upload a French PowerPoint and ask questions in Korean. The AI extracts slide content and responds in Korean with slide-level citations.',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                      {item.from}
                    </span>
                    <ArrowLeftRight className="w-4 h-4 text-zinc-400" />
                    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                      {item.to}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {item.example}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compared to Other Tools */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              Language Support Compared
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-10">
              Most AI document tools are English-first. DocTalk is multilingual by design.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">Feature</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">DocTalk</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">ChatPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">AskYourPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">NotebookLM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {[
                    { feature: 'Interface languages', doctalk: '11', chatpdf: 'English', askyourpdf: 'English', notebooklm: 'English' },
                    { feature: 'AI chat languages', doctalk: '11+', chatpdf: 'Limited', askyourpdf: 'Limited', notebooklm: 'Limited' },
                    { feature: 'Cross-language queries', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
                    { feature: 'CJK PDF rendering', doctalk: true, chatpdf: true, askyourpdf: false, notebooklm: false },
                    { feature: 'RTL language support', doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
                  ].map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.feature}</td>
                      {[row.doctalk, row.chatpdf, row.askyourpdf, row.notebooklm].map((val, j) => (
                        <td key={j} className="text-center px-4 py-3">
                          {val === true ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          ) : val === false ? (
                            <XCircle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mx-auto" />
                          ) : (
                            <span className="text-sm text-zinc-600 dark:text-zinc-300 font-medium">{val}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CJK Support */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              CJK PDF Support
            </h2>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                Chinese, Japanese, and Korean PDFs require special handling that many AI document tools
                get wrong. Characters display as boxes, tofu, or question marks. Tables break. Citation
                navigation fails.
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                DocTalk uses pdf.js with full CMap (Character Map) and standard font files to render
                CJK characters correctly. Whether the PDF uses embedded fonts, system fonts, or
                references standard CJK encodings, DocTalk displays every character as intended.
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Citation highlighting works with CJK text the same way as Latin text — click a citation
                to jump to the source passage and see it highlighted on the page. The semantic search
                engine indexes CJK text natively, so questions about Chinese, Japanese, or Korean
                documents return accurate, relevant passages.
              </p>
            </div>
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
                  q: 'Can I ask questions in a different language than the document?',
                  a: 'Yes. DocTalk supports cross-language analysis. Upload a document in one language and ask questions in another. The AI finds relevant passages regardless of language and responds in the language you write in.',
                },
                {
                  q: 'Does DocTalk support Chinese, Japanese, and Korean PDFs?',
                  a: 'Yes. DocTalk includes full CJK support with proper CMap and standard font rendering. Characters display correctly regardless of PDF encoding. Citation highlighting and semantic search work natively with CJK text.',
                },
                {
                  q: 'Which languages does the interface support?',
                  a: 'The entire DocTalk interface is available in 11 languages: English, Chinese (Simplified), Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Switch anytime from the language selector.',
                },
                {
                  q: 'Is multilingual chat available on the free plan?',
                  a: 'Yes. All 11 languages are available on every plan, including the free tier with 500 credits per month. There is no language restriction on any plan.',
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

        {/* CTA */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              Chat with Documents in Your Language
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              Try the free demo to see multilingual document chat in action. Upload documents in
              any language and get AI answers with source citations.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Try the Free Demo
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Multi-Format Support
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                DocTalk vs ChatPDF
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/notebooklm" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                DocTalk vs NotebookLM
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
