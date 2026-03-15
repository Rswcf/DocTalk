"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { useLocale } from '../../../i18n';
import {
  Gauge,
  Zap,
  Scale,
  SearchCode,
  ArrowRight,
} from 'lucide-react';

export default function PerformanceModesClient() {
  const { t } = useLocale();

  const modes = [
    {
      icon: Zap,
      name: t('featuresPerformance.mode.quick.name'),
      model: 'DeepSeek V3.2',
      credits: 2,
      speed: t('featuresPerformance.mode.quick.speed'),
      description: t('featuresPerformance.mode.quick.description'),
      bestFor: [
        t('featuresPerformance.mode.quick.bestFor1'),
        t('featuresPerformance.mode.quick.bestFor2'),
        t('featuresPerformance.mode.quick.bestFor3'),
        t('featuresPerformance.mode.quick.bestFor4'),
      ],
      availability: t('featuresPerformance.mode.quick.availability'),
    },
    {
      icon: Scale,
      name: t('featuresPerformance.mode.balanced.name'),
      model: 'Mistral Medium 3.1',
      credits: 8,
      speed: t('featuresPerformance.mode.balanced.speed'),
      description: t('featuresPerformance.mode.balanced.description'),
      bestFor: [
        t('featuresPerformance.mode.balanced.bestFor1'),
        t('featuresPerformance.mode.balanced.bestFor2'),
        t('featuresPerformance.mode.balanced.bestFor3'),
        t('featuresPerformance.mode.balanced.bestFor4'),
      ],
      availability: t('featuresPerformance.mode.balanced.availability'),
    },
    {
      icon: SearchCode,
      name: t('featuresPerformance.mode.thorough.name'),
      model: 'Mistral Large 2512',
      credits: 24,
      speed: t('featuresPerformance.mode.thorough.speed'),
      description: t('featuresPerformance.mode.thorough.description'),
      bestFor: [
        t('featuresPerformance.mode.thorough.bestFor1'),
        t('featuresPerformance.mode.thorough.bestFor2'),
        t('featuresPerformance.mode.thorough.bestFor3'),
        t('featuresPerformance.mode.thorough.bestFor4'),
      ],
      availability: t('featuresPerformance.mode.thorough.availability'),
    },
  ];

  const faqItems = [
    {
      q: t('featuresPerformance.faq.q1'),
      a: t('featuresPerformance.faq.a1'),
    },
    {
      q: t('featuresPerformance.faq.q2'),
      a: t('featuresPerformance.faq.a2'),
    },
    {
      q: t('featuresPerformance.faq.q3'),
      a: t('featuresPerformance.faq.a3'),
    },
    {
      q: t('featuresPerformance.faq.q4'),
      a: t('featuresPerformance.faq.a4'),
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
              <Gauge className="w-4 h-4" />
              {t('featuresPerformance.badge')}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6 leading-tight">
              {t('featuresPerformance.hero.title')}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
              {t('featuresPerformance.hero.subtitle')}
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('featuresPerformance.hero.cta')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Three Modes */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-12 text-center">
              {t('featuresPerformance.modes.title')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {modes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <div
                    key={mode.name}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                          {mode.name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {mode.model}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <span className="inline-flex items-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {mode.credits} {t('featuresPerformance.credits')}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {mode.speed}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                      {mode.description}
                    </p>

                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('featuresPerformance.bestFor')}
                      </p>
                      <ul className="space-y-1">
                        {mode.bestFor.map((item, j) => (
                          <li key={j} className="text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-1.5">
                            <span className="text-zinc-400 dark:text-zinc-600 mt-0.5">&#x2022;</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {mode.availability}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* When to Use Each */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('featuresPerformance.whenToUse.title')}
            </h2>
            <div className="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">{t('featuresPerformance.mode.quick.name')}</strong> {t('featuresPerformance.whenToUse.quick')}
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">{t('featuresPerformance.mode.balanced.name')}</strong> {t('featuresPerformance.whenToUse.balanced')}
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">{t('featuresPerformance.mode.thorough.name')}</strong> {t('featuresPerformance.whenToUse.thorough')}
              </p>
              <p>
                {t('featuresPerformance.whenToUse.switching')}
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10 text-center">
              {t('featuresPerformance.faq.title')}
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

        {/* CTA */}
        <section className="bg-white dark:bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('featuresPerformance.cta.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto mb-8">
              {t('featuresPerformance.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {t('featuresPerformance.cta.demoButton')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('featuresPerformance.cta.pricingButton')}
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresPerformance.cta.linkPricing')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresPerformance.cta.linkCitations')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('featuresPerformance.cta.linkDemo')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
