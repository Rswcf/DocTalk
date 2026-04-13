"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { useLocale } from '../../../i18n';
import {
  Quote,
  MousePointerClick,
  Search,
  Shield,
  FileText,
  Scale,
  BarChart3,
  GraduationCap,
  ArrowRight,
  CheckCircle,
  XCircle,
  Minus,
} from 'lucide-react';

export default function CitationsClient() {
  const { t } = useLocale();

  const howSteps = [
    {
      step: '1',
      icon: Search,
      title: t('featuresCitations.howStep1Title'),
      description: t('featuresCitations.howStep1Desc'),
    },
    {
      step: '2',
      icon: FileText,
      title: t('featuresCitations.howStep2Title'),
      description: t('featuresCitations.howStep2Desc'),
    },
    {
      step: '3',
      icon: MousePointerClick,
      title: t('featuresCitations.howStep3Title'),
      description: t('featuresCitations.howStep3Desc'),
    },
  ];

  const layers = [
    {
      icon: Search,
      title: t('featuresCitations.layer1Title'),
      description: t('featuresCitations.layer1Desc'),
    },
    {
      icon: FileText,
      title: t('featuresCitations.layer2Title'),
      description: t('featuresCitations.layer2Desc'),
    },
    {
      icon: MousePointerClick,
      title: t('featuresCitations.layer3Title'),
      description: t('featuresCitations.layer3Desc'),
    },
  ];

  const comparisonRows = [
    { feature: t('featuresCitations.compNumberedCitations'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compClickHighlight'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compPageAttribution'), doctalk: true, chatpdf: true, askyourpdf: 'partial' as const, humata: 'partial' as const },
    { feature: t('featuresCitations.compBboxHighlight'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compTextSnippet'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
    { feature: t('featuresCitations.compMultiFormat'), doctalk: true, chatpdf: false, askyourpdf: false, humata: false },
  ];

  const useCases = [
    {
      icon: GraduationCap,
      title: t('featuresCitations.useCaseAcademicTitle'),
      description: t('featuresCitations.useCaseAcademicDesc'),
      link: '/use-cases/students',
      linkText: t('featuresCitations.useCaseAcademicLink'),
    },
    {
      icon: Scale,
      title: t('featuresCitations.useCaseLegalTitle'),
      description: t('featuresCitations.useCaseLegalDesc'),
      link: '/use-cases/lawyers',
      linkText: t('featuresCitations.useCaseLegalLink'),
    },
    {
      icon: BarChart3,
      title: t('featuresCitations.useCaseFinanceTitle'),
      description: t('featuresCitations.useCaseFinanceDesc'),
      link: '/demo',
      linkText: t('featuresCitations.useCaseFinanceLink'),
    },
  ];

  const faqItems = [
    {
      q: t('featuresCitations.faq1Q'),
      a: t('featuresCitations.faq1A'),
    },
    {
      q: t('featuresCitations.faq2Q'),
      a: t('featuresCitations.faq2A'),
    },
    {
      q: t('featuresCitations.faq3Q'),
      a: t('featuresCitations.faq3A'),
    },
    {
      q: t('featuresCitations.faq4Q'),
      a: t('featuresCitations.faq4A'),
    },
    {
      q: t('featuresCitations.faq5Q'),
      a: t('featuresCitations.faq5A'),
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
              <Quote className="w-4 h-4" />
              {t('featuresCitations.heroBadge')}
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              {t('featuresCitations.heroTitle')}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
              {t('featuresCitations.heroSubtitle')}
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('featuresCitations.heroCta')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* How Citation Highlighting Works */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresCitations.howTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-center max-w-2xl mx-auto mb-12">
              {t('featuresCitations.howSubtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {howSteps.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-semibold text-sm mb-4">
                      {item.step}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Citations Matter */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('featuresCitations.whyTitle')}
            </h2>
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                {t('featuresCitations.whyPara1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                {t('featuresCitations.whyPara2')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                {t('featuresCitations.whyPara3')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t('featuresCitations.whyPara4')}
              </p>
            </div>
          </div>
        </section>

        {/* Three Layers of Citation Accuracy */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresCitations.layersTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-center max-w-2xl mx-auto mb-12">
              {t('featuresCitations.layersSubtitle')}
            </p>

            <div className="space-y-6">
              {layers.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex gap-4"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-300 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Citation Quality Compared */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresCitations.compTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-center max-w-2xl mx-auto mb-10">
              {t('featuresCitations.compSubtitle')}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresCitations.compHeaderFeature')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresCitations.compHeaderDocTalk')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-300">{t('featuresCitations.compHeaderChatPDF')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-300">{t('featuresCitations.compHeaderAskYourPDF')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-300">{t('featuresCitations.compHeaderHumata')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {comparisonRows.map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.feature}</td>
                      {[row.doctalk, row.chatpdf, row.askyourpdf, row.humata].map((val, j) => (
                        <td key={j} className="text-center px-4 py-3">
                          {val === true ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          ) : val === false ? (
                            <XCircle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mx-auto" />
                          ) : (
                            <Minus className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4 text-center">
              {t('featuresCitations.compDisclaimer')}
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresCitations.useCasesTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-center max-w-2xl mx-auto mb-12">
              {t('featuresCitations.useCasesSubtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {useCases.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300 leading-relaxed mb-4">
                      {item.description}
                    </p>
                    <Link
                      href={item.link}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      {item.linkText}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10 text-center">
              {t('featuresCitations.faqTitle')}
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

        {/* CTA Banner */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('featuresCitations.ctaTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto mb-8">
              {t('featuresCitations.ctaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {t('featuresCitations.ctaDemoButton')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/features/multi-format"
                className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('featuresCitations.ctaFormatsButton')}
              </Link>
            </div>

            {/* Internal links */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/features/multi-format" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresCitations.linkMultiFormat')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/chatpdf" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresCitations.linkVsChatPDF')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/students" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresCitations.linkStudents')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/lawyers" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresCitations.linkLawyers')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
