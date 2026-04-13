"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useLocale } from '../../i18n';
import {
  Quote,
  FileStack,
  Languages,
  PlayCircle,
  Gauge,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function FeaturesHubClient() {
  const { t } = useLocale();

  const features = [
    {
      slug: 'citations',
      icon: Quote,
      title: t('featuresHub.citationsTitle'),
      description: t('featuresHub.citationsDesc'),
    },
    {
      slug: 'multi-format',
      icon: FileStack,
      title: t('featuresHub.multiFormatTitle'),
      description: t('featuresHub.multiFormatDesc'),
    },
    {
      slug: 'multilingual',
      icon: Languages,
      title: t('featuresHub.multilingualTitle'),
      description: t('featuresHub.multilingualDesc'),
    },
    {
      slug: 'free-demo',
      icon: PlayCircle,
      title: t('featuresHub.freeDemoTitle'),
      description: t('featuresHub.freeDemoDesc'),
    },
    {
      slug: 'performance-modes',
      icon: Gauge,
      title: t('featuresHub.performanceModesTitle'),
      description: t('featuresHub.performanceModesDesc'),
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
              <Sparkles className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">
              {t('featuresHub.heroTitle')}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto">
              {t('featuresHub.heroSubtitle')}
            </p>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.slug}
                  href={`/features/${f.slug}`}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors duration-200">
                    <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200" />
                  </div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                    <span>{f.title}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-[color,transform] duration-200" />
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {f.description}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="mt-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t('featuresHub.workflowsTitle')}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              {t('featuresHub.workflowsDesc')}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/use-cases/students" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresHub.linkStudents')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/lawyers" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresHub.linkLawyers')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/use-cases/finance" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresHub.linkFinance')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/compare/chatpdf" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresHub.linkVsChatPDF')}
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href="/blog/category/comparisons" className="text-blue-600 dark:text-blue-400 hover:underline">
                {t('featuresHub.linkComparisons')}
              </Link>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-600 dark:text-zinc-300 mb-5">
              {t('featuresHub.ctaText')}
            </p>
            <Link
              href="/demo"
              className="group inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
            >
              {t('featuresHub.ctaButton')}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
