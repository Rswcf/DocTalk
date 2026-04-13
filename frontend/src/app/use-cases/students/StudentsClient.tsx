"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import { useLocale } from '../../../i18n';
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

export default function StudentsClient() {
  const { t } = useLocale();

  const faqItems = [
    {
      question: t('useCasesStudents.faq.q1'),
      answer: t('useCasesStudents.faq.a1'),
    },
    {
      question: t('useCasesStudents.faq.q2'),
      answer: t('useCasesStudents.faq.a2'),
    },
    {
      question: t('useCasesStudents.faq.q3'),
      answer: t('useCasesStudents.faq.a3'),
    },
    {
      question: t('useCasesStudents.faq.q4'),
      answer: t('useCasesStudents.faq.a4'),
    },
    {
      question: t('useCasesStudents.faq.q5'),
      answer: t('useCasesStudents.faq.a5'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <nav className="flex items-center text-sm text-zinc-500 dark:text-zinc-300 space-x-1">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesStudents.breadcrumb.home')}</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/use-cases" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesStudents.breadcrumb.useCases')}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900 dark:text-zinc-100">{t('useCasesStudents.breadcrumb.current')}</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('useCasesStudents.hero.title')}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            {t('useCasesStudents.hero.subtitle')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" centered className="mb-8" />
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            {t('useCasesStudents.hero.cta')}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The Academic Reading Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesStudents.challenge.title')}
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesStudents.challenge.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesStudents.challenge.p2')}{' '}
                Tools like <a href="https://scholar.google.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Google Scholar</a> and reference managers like <a href="https://www.zotero.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Zotero</a> help find papers, but understanding them still takes time.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesStudents.challenge.p3')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesStudents.challenge.p4')}
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps Researchers */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesStudents.helps.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Search,
                title: t('useCasesStudents.helps.summarize.title'),
                description: t('useCasesStudents.helps.summarize.description'),
              },
              {
                icon: BookOpen,
                title: t('useCasesStudents.helps.methodologies.title'),
                description: t('useCasesStudents.helps.methodologies.description'),
              },
              {
                icon: FileText,
                title: t('useCasesStudents.helps.literature.title'),
                description: t('useCasesStudents.helps.literature.description'),
              },
              {
                icon: GraduationCap,
                title: t('useCasesStudents.helps.exams.title'),
                description: t('useCasesStudents.helps.exams.description'),
              },
              {
                icon: Quote,
                title: t('useCasesStudents.helps.quotes.title'),
                description: t('useCasesStudents.helps.quotes.description'),
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-300">
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
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesStudents.docTypes.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              {t('useCasesStudents.docTypes.intro')}{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('useCasesStudents.docTypes.formatLink')}
              </Link>
              {t('useCasesStudents.docTypes.introSuffix')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { format: t('useCasesStudents.docTypes.pdf.format'), detail: t('useCasesStudents.docTypes.pdf.detail') },
                { format: t('useCasesStudents.docTypes.docx.format'), detail: t('useCasesStudents.docTypes.docx.detail') },
                { format: t('useCasesStudents.docTypes.pptx.format'), detail: t('useCasesStudents.docTypes.pptx.detail') },
                { format: t('useCasesStudents.docTypes.url.format'), detail: t('useCasesStudents.docTypes.url.detail') },
              ].map((item) => (
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

        {/* Real-World Academic Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesStudents.realWorld.title')}
          </h2>

          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesStudents.realWorld.thesis.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                {t('useCasesStudents.realWorld.thesis.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesStudents.realWorld.thesis.p2')}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesStudents.realWorld.litReview.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                {t('useCasesStudents.realWorld.litReview.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesStudents.realWorld.litReview.p2')}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesStudents.realWorld.methodology.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                {t('useCasesStudents.realWorld.methodology.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesStudents.realWorld.methodology.p2')}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesStudents.realWorld.examPrep.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                {t('useCasesStudents.realWorld.examPrep.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesStudents.realWorld.examPrep.p2')}
              </p>
            </div>
          </div>
        </section>

        {/* Why Citations Matter for Academic Work */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesStudents.citations.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesStudents.citations.p1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesStudents.citations.p2a')}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('useCasesStudents.citations.link')}
              </Link>{' '}
              {t('useCasesStudents.citations.p2b')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesStudents.citations.p3')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              {t('useCasesStudents.citations.p4')}
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
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                {t('useCasesStudents.multilingual.title')}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesStudents.multilingual.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesStudents.multilingual.p2a')}
                <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  {t('useCasesStudents.multilingual.link')}
                </Link>{' '}
                {t('useCasesStudents.multilingual.p2b')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesStudents.multilingual.p3')}
              </p>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8 text-center">
              {t('useCasesStudents.getStarted.title')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: Upload,
                  step: '1',
                  title: t('useCasesStudents.getStarted.step1.title'),
                  description: t('useCasesStudents.getStarted.step1.description'),
                },
                {
                  icon: MessageSquare,
                  step: '2',
                  title: t('useCasesStudents.getStarted.step2.title'),
                  description: t('useCasesStudents.getStarted.step2.description'),
                },
                {
                  icon: CheckCircle,
                  step: '3',
                  title: t('useCasesStudents.getStarted.step3.title'),
                  description: t('useCasesStudents.getStarted.step3.description'),
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
                      {item.step}
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
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
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesStudents.faqTitle')}
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
        </section>

        {/* CTA Banner */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('useCasesStudents.cta.title')}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-300 mb-6 max-w-xl mx-auto">
              {t('useCasesStudents.cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {t('useCasesStudents.cta.tryDemo')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('useCasesStudents.cta.viewPricing')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
