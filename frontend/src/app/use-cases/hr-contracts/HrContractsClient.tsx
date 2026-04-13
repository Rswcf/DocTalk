"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import { useLocale } from '../../../i18n';
import {
  FileText,
  Users,
  Search,
  Shield,
  BookOpen,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Lock,
  ClipboardList,
} from 'lucide-react';

export default function HrContractsClient() {
  const { t } = useLocale();

  const faqItems = [
    {
      question: t('useCasesHr.faq.q1'),
      answer: t('useCasesHr.faq.a1'),
    },
    {
      question: t('useCasesHr.faq.q2'),
      answer: t('useCasesHr.faq.a2'),
    },
    {
      question: t('useCasesHr.faq.q3'),
      answer: t('useCasesHr.faq.a3'),
    },
    {
      question: t('useCasesHr.faq.q4'),
      answer: t('useCasesHr.faq.a4'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <nav className="flex items-center text-sm text-zinc-500 dark:text-zinc-300 space-x-1">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesHr.breadcrumb.home')}</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/use-cases" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesHr.breadcrumb.useCases')}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900 dark:text-zinc-100">{t('useCasesHr.breadcrumb.current')}</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('useCasesHr.hero.title')}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            {t('useCasesHr.hero.subtitle')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" centered className="mb-8" />
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            {t('useCasesHr.hero.cta')}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The HR Document Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesHr.challenge.title')}
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesHr.challenge.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesHr.challenge.p2')}{' '}
                Organizations like <a href="https://www.shrm.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">SHRM</a> provide guidance on best practices for policy management.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesHr.challenge.p3')}{' '}
                Compliance with regulations from the <a href="https://www.dol.gov" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">U.S. Department of Labor</a> adds additional complexity.
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesHr.challenge.p4')}
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps HR Teams */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesHr.helps.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Search,
                title: t('useCasesHr.helps.policyQA.title'),
                description: t('useCasesHr.helps.policyQA.description'),
              },
              {
                icon: ClipboardList,
                title: t('useCasesHr.helps.contractClause.title'),
                description: t('useCasesHr.helps.contractClause.description'),
              },
              {
                icon: BookOpen,
                title: t('useCasesHr.helps.handbook.title'),
                description: t('useCasesHr.helps.handbook.description'),
              },
              {
                icon: Users,
                title: t('useCasesHr.helps.onboarding.title'),
                description: t('useCasesHr.helps.onboarding.description'),
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

        {/* Supported Document Types */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesHr.docTypes.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              {t('useCasesHr.docTypes.intro')}{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('useCasesHr.docTypes.formatLink')}
              </Link>
              {t('useCasesHr.docTypes.introSuffix')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { format: t('useCasesHr.docTypes.docx.format'), detail: t('useCasesHr.docTypes.docx.detail') },
                { format: t('useCasesHr.docTypes.pdf.format'), detail: t('useCasesHr.docTypes.pdf.detail') },
                { format: t('useCasesHr.docTypes.pptx.format'), detail: t('useCasesHr.docTypes.pptx.detail') },
                { format: t('useCasesHr.docTypes.xlsx.format'), detail: t('useCasesHr.docTypes.xlsx.detail') },
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

        {/* Real-World Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesHr.realWorld.title')}
          </h2>

          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesHr.realWorld.pto.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesHr.realWorld.pto.description')}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesHr.realWorld.nonCompete.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesHr.realWorld.nonCompete.p1')}
                <Link href="/use-cases/lawyers" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  {t('useCasesHr.realWorld.nonCompete.link')}
                </Link>{' '}
                {t('useCasesHr.realWorld.nonCompete.p2')}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesHr.realWorld.benefits.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesHr.realWorld.benefits.description')}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {t('useCasesHr.realWorld.onboarding.title')}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesHr.realWorld.onboarding.description')}
              </p>
            </div>
          </div>
        </section>

        {/* Privacy & Security */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                  {t('useCasesHr.security.title')}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                  {t('useCasesHr.security.description')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Lock, title: t('useCasesHr.security.encryption.title'), detail: t('useCasesHr.security.encryption.detail') },
                { icon: Shield, title: t('useCasesHr.security.noTraining.title'), detail: t('useCasesHr.security.noTraining.detail') },
                { icon: FileText, title: t('useCasesHr.security.gdpr.title'), detail: t('useCasesHr.security.gdpr.detail') },
                { icon: CheckCircle, title: t('useCasesHr.security.dataControl.title'), detail: t('useCasesHr.security.dataControl.detail') },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-300">
                      {item.detail}
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
            {t('useCasesHr.faqTitle')}
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
              {t('useCasesHr.cta.title')}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-300 mb-6 max-w-xl mx-auto">
              {t('useCasesHr.cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {t('useCasesHr.cta.tryDemo')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('useCasesHr.cta.viewPricing')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
