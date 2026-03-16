"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ArrowRight, Repeat } from 'lucide-react';
import { useLocale } from '../../i18n';

export default function AlternativesHubClient() {
  const { t } = useLocale();

  const alternatives = [
    {
      slug: 'chatpdf',
      name: 'ChatPDF',
      tagline: t('altsHub.chatpdfTagline'),
      count: 7,
    },
    {
      slug: 'notebooklm',
      name: 'NotebookLM',
      tagline: t('altsHub.notebooklmTagline'),
      count: 6,
    },
    {
      slug: 'humata',
      name: 'Humata',
      tagline: t('altsHub.humataTagline'),
      count: 5,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-6">
              <Repeat className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
              {t('altsHub.title')}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto">
              {t('altsHub.subtitle')}
            </p>
          </div>
        </section>

        {/* Alternatives Grid */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {alternatives.map((alt) => (
              <Link
                key={alt.slug}
                href={`/alternatives/${alt.slug}`}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('altsHub.alternativesFor', { name: alt.name })}
                  </h2>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-[color,transform] duration-200" />
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                  {alt.tagline}
                </p>
                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {t('altsHub.alternativesCompared', { count: alt.count })}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t('altsHub.decisionTitle')}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              {t('altsHub.decisionDescription')}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('altsHub.linkVsChatpdf')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/notebooklm" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('altsHub.linkVsNotebooklm')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('altsHub.linkMultiFormat')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/features/performance-modes" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('altsHub.linkPerformanceModes')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('altsHub.linkPricing')}
              </Link>
            </div>
          </div>

          {/* Link to comparisons */}
          <div className="mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-600 dark:text-zinc-300 mb-5">
              {t('altsHub.comparePrompt')}
            </p>
            <Link
              href="/compare"
              className="group inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
            >
              {t('altsHub.viewComparisons')}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
