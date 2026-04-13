"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { useLocale } from '../../../i18n';
import {
  Languages,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const languageData = [
  { flag: '\u{1F1FA}\u{1F1F8}', native: 'English', englishKey: 'featuresMultilingual.lang.english', code: 'en' },
  { flag: '\u{1F1E8}\u{1F1F3}', native: '\u4E2D\u6587', englishKey: 'featuresMultilingual.lang.chinese', code: 'zh' },
  { flag: '\u{1F1EF}\u{1F1F5}', native: '\u65E5\u672C\u8A9E', englishKey: 'featuresMultilingual.lang.japanese', code: 'ja' },
  { flag: '\u{1F1EA}\u{1F1F8}', native: 'Espa\u00F1ol', englishKey: 'featuresMultilingual.lang.spanish', code: 'es' },
  { flag: '\u{1F1E9}\u{1F1EA}', native: 'Deutsch', englishKey: 'featuresMultilingual.lang.german', code: 'de' },
  { flag: '\u{1F1EB}\u{1F1F7}', native: 'Fran\u00E7ais', englishKey: 'featuresMultilingual.lang.french', code: 'fr' },
  { flag: '\u{1F1F0}\u{1F1F7}', native: '\uD55C\uAD6D\uC5B4', englishKey: 'featuresMultilingual.lang.korean', code: 'ko' },
  { flag: '\u{1F1E7}\u{1F1F7}', native: 'Portugu\u00EAs', englishKey: 'featuresMultilingual.lang.portuguese', code: 'pt' },
  { flag: '\u{1F1EE}\u{1F1F9}', native: 'Italiano', englishKey: 'featuresMultilingual.lang.italian', code: 'it' },
  { flag: '\u{1F1F8}\u{1F1E6}', native: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', englishKey: 'featuresMultilingual.lang.arabic', code: 'ar' },
  { flag: '\u{1F1EE}\u{1F1F3}', native: '\u0939\u093F\u0928\u094D\u0926\u0940', englishKey: 'featuresMultilingual.lang.hindi', code: 'hi' },
];

export default function MultilingualClient() {
  const { t } = useLocale();

  const crossLanguageItems = [
    {
      from: t('featuresMultilingual.cross.item1.from'),
      to: t('featuresMultilingual.cross.item1.to'),
      example: t('featuresMultilingual.cross.item1.example'),
    },
    {
      from: t('featuresMultilingual.cross.item2.from'),
      to: t('featuresMultilingual.cross.item2.to'),
      example: t('featuresMultilingual.cross.item2.example'),
    },
    {
      from: t('featuresMultilingual.cross.item3.from'),
      to: t('featuresMultilingual.cross.item3.to'),
      example: t('featuresMultilingual.cross.item3.example'),
    },
    {
      from: t('featuresMultilingual.cross.item4.from'),
      to: t('featuresMultilingual.cross.item4.to'),
      example: t('featuresMultilingual.cross.item4.example'),
    },
  ];

  const comparisonRows = [
    { feature: t('featuresMultilingual.compare.interfaceLangs'), doctalk: t('featuresMultilingual.compare.eleven'), chatpdf: t('featuresMultilingual.compare.englishOnly'), askyourpdf: t('featuresMultilingual.compare.englishOnly'), notebooklm: t('featuresMultilingual.compare.englishOnly') },
    { feature: t('featuresMultilingual.compare.aiChatLangs'), doctalk: t('featuresMultilingual.compare.elevenPlus'), chatpdf: t('featuresMultilingual.compare.limited'), askyourpdf: t('featuresMultilingual.compare.limited'), notebooklm: t('featuresMultilingual.compare.limited') },
    { feature: t('featuresMultilingual.compare.crossLangQueries'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { feature: t('featuresMultilingual.compare.cjkRendering'), doctalk: true, chatpdf: true, askyourpdf: false, notebooklm: false },
    { feature: t('featuresMultilingual.compare.rtlSupport'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
  ];

  const faqItems = [
    {
      q: t('featuresMultilingual.faq.q1'),
      a: t('featuresMultilingual.faq.a1'),
    },
    {
      q: t('featuresMultilingual.faq.q2'),
      a: t('featuresMultilingual.faq.a2'),
    },
    {
      q: t('featuresMultilingual.faq.q3'),
      a: t('featuresMultilingual.faq.a3'),
    },
    {
      q: t('featuresMultilingual.faq.q4'),
      a: t('featuresMultilingual.faq.a4'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              <Languages className="w-4 h-4" />
              {t('featuresMultilingual.badge')}
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              {t('featuresMultilingual.hero.title')}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
              {t('featuresMultilingual.hero.subtitle')}
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('featuresMultilingual.hero.cta')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Supported Languages Grid */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresMultilingual.supported.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-center max-w-2xl mx-auto mb-12">
              {t('featuresMultilingual.supported.subtitle')}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {languageData.map((lang) => (
                <div
                  key={lang.code}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center"
                >
                  <span className="text-2xl mb-2 block" role="img" aria-label={t(lang.englishKey) + ' flag'}>
                    {lang.flag}
                  </span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    {lang.native}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-300">
                    {t(lang.englishKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How Multilingual Chat Works */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('featuresMultilingual.howItWorks.title')}
            </h2>
            <div className="space-y-4 text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p>
                {t('featuresMultilingual.howItWorks.p1')}
              </p>
              <p>
                {t('featuresMultilingual.howItWorks.p2')}
              </p>
              <p>
                {t('featuresMultilingual.howItWorks.p3')}
              </p>
            </div>
          </div>
        </section>

        {/* Cross-Language Analysis */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresMultilingual.cross.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-center max-w-2xl mx-auto mb-12">
              {t('featuresMultilingual.cross.subtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {crossLanguageItems.map((item, i) => (
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-300 leading-relaxed">
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
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresMultilingual.compare.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-center max-w-2xl mx-auto mb-10">
              {t('featuresMultilingual.compare.subtitle')}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresMultilingual.compare.featureCol')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">DocTalk</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-300">ChatPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-300">AskYourPDF</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-300">NotebookLM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {comparisonRows.map((row, i) => (
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
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('featuresMultilingual.cjk.title')}
            </h2>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                {t('featuresMultilingual.cjk.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                {t('featuresMultilingual.cjk.p2')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t('featuresMultilingual.cjk.p3')}
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10 text-center">
              {t('featuresMultilingual.faq.title')}
            </h2>

            <div className="space-y-6 max-w-3xl mx-auto">
              {faqItems.map((item, i) => (
                <div
                  key={i}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-300 leading-relaxed">
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
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('featuresMultilingual.cta.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto mb-8">
              {t('featuresMultilingual.cta.subtitle')}
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('featuresMultilingual.cta.button')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/features/multi-format" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresMultilingual.cta.linkMultiFormat')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/chatpdf" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresMultilingual.cta.linkVsChatPDF')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/notebooklm" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresMultilingual.cta.linkVsNotebookLM')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
