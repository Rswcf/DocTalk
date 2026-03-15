"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { useLocale } from '../../../i18n';
import {
  PlayCircle,
  ArrowRight,
  FileText,
  MessageSquare,
  Quote,
  CheckCircle,
  Minus,
} from 'lucide-react';

export default function FreeDemoClient() {
  const { t } = useLocale();

  const demoDocs = [
    {
      title: t('featuresDemo.docs.doc1.title'),
      description: t('featuresDemo.docs.doc1.description'),
    },
    {
      title: t('featuresDemo.docs.doc2.title'),
      description: t('featuresDemo.docs.doc2.description'),
    },
    {
      title: t('featuresDemo.docs.doc3.title'),
      description: t('featuresDemo.docs.doc3.description'),
    },
  ];

  const whatYouGet = [
    { label: t('featuresDemo.whatYouGet.item1.label'), description: t('featuresDemo.whatYouGet.item1.description') },
    { label: t('featuresDemo.whatYouGet.item2.label'), description: t('featuresDemo.whatYouGet.item2.description') },
    { label: t('featuresDemo.whatYouGet.item3.label'), description: t('featuresDemo.whatYouGet.item3.description') },
    { label: t('featuresDemo.whatYouGet.item4.label'), description: t('featuresDemo.whatYouGet.item4.description') },
  ];

  const comparisonRows = [
    { feature: t('featuresDemo.compare.monthlyCredits'), demo: t('featuresDemo.compare.fiveMsgs'), free: '500', plus: '3,000', pro: '9,000' },
    { feature: t('featuresDemo.compare.uploadOwn'), demo: false, free: true, plus: true, pro: true },
    { feature: t('featuresDemo.compare.citationHighlighting'), demo: true, free: true, plus: true, pro: true },
    { feature: t('featuresDemo.compare.quickBalanced'), demo: t('featuresDemo.compare.quickOnly'), free: true, plus: true, pro: true },
    { feature: t('featuresDemo.compare.thoroughMode'), demo: false, free: false, plus: true, pro: true },
    { feature: t('featuresDemo.compare.export'), demo: false, free: false, plus: true, pro: true },
    { feature: t('featuresDemo.compare.customInstructions'), demo: false, free: false, plus: false, pro: true },
    { feature: t('featuresDemo.compare.signupRequired'), demo: false, free: true, plus: true, pro: true },
  ];

  const steps = [
    {
      step: '1',
      icon: PlayCircle,
      title: t('featuresDemo.steps.step1.title'),
      description: t('featuresDemo.steps.step1.description'),
    },
    {
      step: '2',
      icon: FileText,
      title: t('featuresDemo.steps.step2.title'),
      description: t('featuresDemo.steps.step2.description'),
    },
    {
      step: '3',
      icon: MessageSquare,
      title: t('featuresDemo.steps.step3.title'),
      description: t('featuresDemo.steps.step3.description'),
    },
    {
      step: '4',
      icon: Quote,
      title: t('featuresDemo.steps.step4.title'),
      description: t('featuresDemo.steps.step4.description'),
    },
  ];

  const faqItems = [
    {
      q: t('featuresDemo.faq.q1'),
      a: t('featuresDemo.faq.a1'),
    },
    {
      q: t('featuresDemo.faq.q2'),
      a: t('featuresDemo.faq.a2'),
    },
    {
      q: t('featuresDemo.faq.q3'),
      a: t('featuresDemo.faq.a3'),
    },
    {
      q: t('featuresDemo.faq.q4'),
      a: t('featuresDemo.faq.a4'),
    },
    {
      q: t('featuresDemo.faq.q5'),
      a: t('featuresDemo.faq.a5'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              <PlayCircle className="w-4 h-4" />
              {t('featuresDemo.badge')}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              {t('featuresDemo.hero.title')}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              {t('featuresDemo.hero.subtitle')}
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-8 py-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('featuresDemo.hero.cta')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Instant Demo */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresDemo.instant.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-12">
              {t('featuresDemo.instant.subtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {demoDocs.map((doc, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {doc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What You Get */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 text-center">
              {t('featuresDemo.whatYouGet.title')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {whatYouGet.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                      {item.label}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free Plan vs Paid */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4 text-center">
              {t('featuresDemo.compare.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto mb-10">
              {t('featuresDemo.compare.subtitle')}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresDemo.compare.featureCol')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">{t('featuresDemo.compare.demoCol')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresDemo.compare.freeCol')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresDemo.compare.plusCol')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{t('featuresDemo.compare.proCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {comparisonRows.map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.feature}</td>
                      {[row.demo, row.free, row.plus, row.pro].map((val, j) => (
                        <td key={j} className="text-center px-4 py-3">
                          {val === true ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          ) : val === false ? (
                            <Minus className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mx-auto" />
                          ) : (
                            <span className="text-sm text-zinc-600 dark:text-zinc-300">{val}</span>
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

        {/* How to Get Started */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-12 text-center">
              {t('featuresDemo.steps.title')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-lg mx-auto mb-4">
                      {item.step}
                    </div>
                    <Icon className="w-6 h-6 text-zinc-600 dark:text-zinc-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10 text-center">
              {t('featuresDemo.faq.title')}
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
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('featuresDemo.cta.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              {t('featuresDemo.cta.subtitle')}
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-8 py-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('featuresDemo.cta.button')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresDemo.cta.linkPricing')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresDemo.cta.linkCitations')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresDemo.cta.linkMultiFormat')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
