"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { useLocale } from '../../../i18n';
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

export default function MultiFormatClient() {
  const { t } = useLocale();

  const formats = [
    {
      icon: FileText,
      name: t('featuresMultiFormat.formatPdfName'),
      ext: t('featuresMultiFormat.formatPdfExt'),
      description: t('featuresMultiFormat.formatPdfDesc'),
    },
    {
      icon: FileType,
      name: t('featuresMultiFormat.formatDocxName'),
      ext: t('featuresMultiFormat.formatDocxExt'),
      description: t('featuresMultiFormat.formatDocxDesc'),
    },
    {
      icon: Presentation,
      name: t('featuresMultiFormat.formatPptxName'),
      ext: t('featuresMultiFormat.formatPptxExt'),
      description: t('featuresMultiFormat.formatPptxDesc'),
    },
    {
      icon: FileSpreadsheet,
      name: t('featuresMultiFormat.formatXlsxName'),
      ext: t('featuresMultiFormat.formatXlsxExt'),
      description: t('featuresMultiFormat.formatXlsxDesc'),
    },
    {
      icon: Code2,
      name: t('featuresMultiFormat.formatTxtName'),
      ext: t('featuresMultiFormat.formatTxtExt'),
      description: t('featuresMultiFormat.formatTxtDesc'),
    },
    {
      icon: Globe,
      name: t('featuresMultiFormat.formatUrlName'),
      ext: t('featuresMultiFormat.formatUrlExt'),
      description: t('featuresMultiFormat.formatUrlDesc'),
    },
  ];

  const howSteps = [
    {
      step: '1',
      icon: Upload,
      title: t('featuresMultiFormat.howStep1Title'),
      description: t('featuresMultiFormat.howStep1Desc'),
    },
    {
      step: '2',
      icon: Zap,
      title: t('featuresMultiFormat.howStep2Title'),
      description: t('featuresMultiFormat.howStep2Desc'),
    },
    {
      step: '3',
      icon: MessageSquare,
      title: t('featuresMultiFormat.howStep3Title'),
      description: t('featuresMultiFormat.howStep3Desc'),
    },
  ];

  const formatDetails = [
    { format: t('featuresMultiFormat.detailPdfFormat'), detail: t('featuresMultiFormat.detailPdfText') },
    { format: t('featuresMultiFormat.detailDocxFormat'), detail: t('featuresMultiFormat.detailDocxText') },
    { format: t('featuresMultiFormat.detailPptxFormat'), detail: t('featuresMultiFormat.detailPptxText') },
    { format: t('featuresMultiFormat.detailXlsxFormat'), detail: t('featuresMultiFormat.detailXlsxText') },
    { format: t('featuresMultiFormat.detailTxtFormat'), detail: t('featuresMultiFormat.detailTxtText') },
    { format: t('featuresMultiFormat.detailUrlFormat'), detail: t('featuresMultiFormat.detailUrlText') },
  ];

  const comparisonRows = [
    { format: t('featuresMultiFormat.compPdf'), doctalk: true, chatpdf: true, askyourpdf: true, notebooklm: true },
    { format: t('featuresMultiFormat.compDocx'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { format: t('featuresMultiFormat.compPptx'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { format: t('featuresMultiFormat.compXlsx'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
    { format: t('featuresMultiFormat.compTxtMd'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: true },
    { format: t('featuresMultiFormat.compUrl'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: true },
    { format: t('featuresMultiFormat.compCitationHighlight'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
  ];

  const faqItems = [
    { q: t('featuresMultiFormat.faq1Q'), a: t('featuresMultiFormat.faq1A') },
    { q: t('featuresMultiFormat.faq2Q'), a: t('featuresMultiFormat.faq2A') },
    { q: t('featuresMultiFormat.faq3Q'), a: t('featuresMultiFormat.faq3A') },
    { q: t('featuresMultiFormat.faq4Q'), a: t('featuresMultiFormat.faq4A') },
    { q: t('featuresMultiFormat.faq5Q'), a: t('featuresMultiFormat.faq5A') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              <FileText className="w-4 h-4" />
              {t('featuresMultiFormat.heroBadge')}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              {t('featuresMultiFormat.heroTitle')}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              {t('featuresMultiFormat.heroSubtitle')}
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('featuresMultiFormat.heroCta')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Supported Formats Grid */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresMultiFormat.formatsTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              {t('featuresMultiFormat.formatsSubtitle')}
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
              {t('featuresMultiFormat.whyTitle')}
            </h2>
            <div className="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <p>
                {t('featuresMultiFormat.whyPara1')}
              </p>
              <p>
                {t('featuresMultiFormat.whyPara2')}
              </p>
              <p>
                {t('featuresMultiFormat.whyPara3')}
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-12 text-center">
              {t('featuresMultiFormat.howTitle')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {howSteps.map((item) => {
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
              {t('featuresMultiFormat.detailsTitle')}
            </h2>
            <div className="space-y-4">
              {formatDetails.map((item, i) => (
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
              {t('featuresMultiFormat.compTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-10">
              {t('featuresMultiFormat.compSubtitle')}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresMultiFormat.compHeaderFormat')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresMultiFormat.compHeaderDocTalk')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">{t('featuresMultiFormat.compHeaderChatPDF')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">{t('featuresMultiFormat.compHeaderAskYourPDF')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">{t('featuresMultiFormat.compHeaderNotebookLM')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {comparisonRows.map((row, i) => (
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
              {t('featuresMultiFormat.compDisclaimer')}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10 text-center">
              {t('featuresMultiFormat.faqTitle')}
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
              {t('featuresMultiFormat.ctaTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              {t('featuresMultiFormat.ctaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {t('featuresMultiFormat.ctaDemoButton')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('featuresMultiFormat.ctaPricingButton')}
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresMultiFormat.linkCitations')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresMultiFormat.linkVsChatPDF')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresMultiFormat.linkMultilingual')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
