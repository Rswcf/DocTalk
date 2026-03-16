"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import { useLocale } from '../../../i18n';
import {
  TrendingUp,
  Search,
  FileText,
  Table,
  BarChart3,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

const featureIcons = [BarChart3, TrendingUp, Search, FileText];
const featureKeys = ['extractMetrics', 'comparePeriods', 'summarizeRisks', 'findDisclosures'];
const docTypeKeys = ['pdf10K', 'xlsxModels', 'docxReports', 'pptxPresentations'];
const useCaseKeys = ['annualReport', 'earningsCall', 'quarterlyComparison', 'dueDiligence'];

export default function FinanceClient() {
  const { t } = useLocale();

  const faqItems = [
    { question: t('useCasesFinance.faq.q1.question'), answer: t('useCasesFinance.faq.q1.answer') },
    { question: t('useCasesFinance.faq.q2.question'), answer: t('useCasesFinance.faq.q2.answer') },
    { question: t('useCasesFinance.faq.q3.question'), answer: t('useCasesFinance.faq.q3.answer') },
    { question: t('useCasesFinance.faq.q4.question'), answer: t('useCasesFinance.faq.q4.answer') },
    { question: t('useCasesFinance.faq.q5.question'), answer: t('useCasesFinance.faq.q5.answer') },
  ];

  const features = featureKeys.map((key, i) => ({
    icon: featureIcons[i],
    title: t(`useCasesFinance.features.${key}.title`),
    description: t(`useCasesFinance.features.${key}.description`),
  }));

  const docTypes = docTypeKeys.map((key) => ({
    format: t(`useCasesFinance.docTypes.${key}.format`),
    detail: t(`useCasesFinance.docTypes.${key}.detail`),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <nav className="flex items-center text-sm text-zinc-500 dark:text-zinc-300 space-x-1">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesFinance.breadcrumb.home')}</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/use-cases" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesFinance.breadcrumb.useCases')}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900 dark:text-zinc-100">{t('useCasesFinance.breadcrumb.current')}</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('useCasesFinance.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            {t('useCasesFinance.heroDescription')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" centered className="mb-8" />
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            {t('useCasesFinance.heroCta')}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The Financial Analysis Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesFinance.challenge.title')}
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesFinance.challenge.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesFinance.challenge.p2')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesFinance.challenge.p3')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesFinance.challenge.p4')}
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps Financial Analysts */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesFinance.howItHelps.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((item) => {
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-300">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Supported Financial Document Types */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesFinance.docTypes.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              {t('useCasesFinance.docTypes.description')}{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('useCasesFinance.docTypes.formatsLink')}
              </Link>
              {t('useCasesFinance.docTypes.descriptionSuffix')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {docTypes.map((item) => (
                <div
                  key={item.format}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
                >
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                    {item.format}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-300">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Real-World Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesFinance.realWorld.title')}
          </h2>

          <div className="space-y-10">
            {useCaseKeys.map((key) => (
              <div key={key}>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  {t(`useCasesFinance.realWorld.${key}.title`)}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                  {t(`useCasesFinance.realWorld.${key}.p1`)}
                </p>
                {t(`useCasesFinance.realWorld.${key}.p2`) && (
                  <p className="text-zinc-600 dark:text-zinc-300">
                    {t(`useCasesFinance.realWorld.${key}.p2`)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Why Cited Answers Matter for Finance */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesFinance.whyCitations.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesFinance.whyCitations.p1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesFinance.whyCitations.p2pre')}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('useCasesFinance.whyCitations.p2link')}
              </Link>
              {t('useCasesFinance.whyCitations.p2post')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              {t('useCasesFinance.whyCitations.p3')}
            </p>
          </div>
        </section>

        {/* Excel Support */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Table className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                {t('useCasesFinance.excel.title')}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesFinance.excel.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesFinance.excel.p2')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesFinance.excel.p3')}
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              {t('useCasesFinance.faq.title')}
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-300">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('useCasesFinance.cta.title')}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-300 mb-6 max-w-xl mx-auto">
            {t('useCasesFinance.cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              {t('useCasesFinance.cta.tryFreeDemo')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center px-6 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('useCasesFinance.cta.viewPricing')}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
