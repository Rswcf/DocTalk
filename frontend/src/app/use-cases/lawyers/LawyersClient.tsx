"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import { useLocale } from '../../../i18n';
import {
  Scale,
  Search,
  FileText,
  Shield,
  Clock,
  Quote,
  Upload,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Lock,
  AlertTriangle,
} from 'lucide-react';

const featureIcons = [Search, Clock, FileText, AlertTriangle, Quote];
const featureKeys = ['clauseExtraction', 'dueDiligence', 'filingSummarization', 'riskAssessment', 'keyTerms'];
const docTypeKeys = ['pdfContracts', 'docxBriefs', 'courtFilings', 'regulatory'];
const useCaseKeys = ['contractReview', 'dueDiligenceCase', 'courtFiling', 'patentReview'];
const securityIcons = [Lock, Shield, FileText, CheckCircle];
const securityKeys = ['encryption', 'noTraining', 'gdpr', 'dataExport'];
const stepIcons = [Upload, MessageSquare, CheckCircle];
const stepKeys = ['upload', 'ask', 'verify'];

export default function LawyersClient() {
  const { t } = useLocale();

  const faqItems = [
    { question: t('useCasesLawyers.faq.q1.question'), answer: t('useCasesLawyers.faq.q1.answer') },
    { question: t('useCasesLawyers.faq.q2.question'), answer: t('useCasesLawyers.faq.q2.answer') },
    { question: t('useCasesLawyers.faq.q3.question'), answer: t('useCasesLawyers.faq.q3.answer') },
    { question: t('useCasesLawyers.faq.q4.question'), answer: t('useCasesLawyers.faq.q4.answer') },
    { question: t('useCasesLawyers.faq.q5.question'), answer: t('useCasesLawyers.faq.q5.answer') },
  ];

  const features = featureKeys.map((key, i) => ({
    icon: featureIcons[i],
    title: t(`useCasesLawyers.features.${key}.title`),
    description: t(`useCasesLawyers.features.${key}.description`),
  }));

  const docTypes = docTypeKeys.map((key) => ({
    format: t(`useCasesLawyers.docTypes.${key}.format`),
    detail: t(`useCasesLawyers.docTypes.${key}.detail`),
  }));

  const securityItems = securityKeys.map((key, i) => ({
    icon: securityIcons[i],
    title: t(`useCasesLawyers.security.items.${key}.title`),
    detail: t(`useCasesLawyers.security.items.${key}.detail`),
  }));

  const steps = stepKeys.map((key, i) => ({
    icon: stepIcons[i],
    step: String(i + 1),
    title: t(`useCasesLawyers.steps.${key}.title`),
    description: t(`useCasesLawyers.steps.${key}.description`),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <nav className="flex items-center text-sm text-zinc-500 dark:text-zinc-300 space-x-1">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesLawyers.breadcrumb.home')}</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/use-cases" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t('useCasesLawyers.breadcrumb.useCases')}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900 dark:text-zinc-100">{t('useCasesLawyers.breadcrumb.current')}</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Scale className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('useCasesLawyers.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-300 max-w-2xl mx-auto mb-8">
            {t('useCasesLawyers.heroDescription')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" centered className="mb-8" />
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            {t('useCasesLawyers.heroCta')}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </section>

        {/* The Legal Document Challenge */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesLawyers.challenge.title')}
            </h2>
            <div className="prose-zinc max-w-none">
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesLawyers.challenge.p1')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesLawyers.challenge.p2')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesLawyers.challenge.p3')}
              </p>
              <p className="text-zinc-600 dark:text-zinc-300">
                {t('useCasesLawyers.challenge.p4')}
              </p>
            </div>
          </div>
        </section>

        {/* How DocTalk Helps Legal Professionals */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesLawyers.howItHelps.title')}
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

        {/* Supported Legal Document Types */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesLawyers.docTypes.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              {t('useCasesLawyers.docTypes.description')}{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('useCasesLawyers.docTypes.formatsLink')}
              </Link>
              {t('useCasesLawyers.docTypes.descriptionSuffix')}
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

        {/* Real-World Legal Use Cases */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesLawyers.realWorld.title')}
          </h2>

          <div className="space-y-10">
            {useCaseKeys.map((key) => (
              <div key={key}>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  {t(`useCasesLawyers.realWorld.${key}.title`)}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-300 mb-3">
                  {t(`useCasesLawyers.realWorld.${key}.p1`)}
                </p>
                {t(`useCasesLawyers.realWorld.${key}.p2`) && (
                  <p className="text-zinc-600 dark:text-zinc-300">
                    {t(`useCasesLawyers.realWorld.${key}.p2`)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Why Citations Are Critical for Legal Work */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('useCasesLawyers.whyCitations.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesLawyers.whyCitations.p1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesLawyers.whyCitations.p2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 mb-4">
              {t('useCasesLawyers.whyCitations.p3pre')}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('useCasesLawyers.whyCitations.p3link')}
              </Link>
              {t('useCasesLawyers.whyCitations.p3post')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">
              {t('useCasesLawyers.whyCitations.p4')}
            </p>
          </div>
        </section>

        {/* Security & Privacy */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-3">
                {t('useCasesLawyers.security.title')}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                {t('useCasesLawyers.security.description')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {securityItems.map((item) => {
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
        </section>

        {/* Getting Started */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8 text-center">
              {t('useCasesLawyers.steps.title')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {steps.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 flex items-center justify-center mx-auto mb-4 text-lg font-bold">
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
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('useCasesLawyers.faq.title')}
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
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('useCasesLawyers.cta.title')}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-300 mb-6 max-w-xl mx-auto">
              {t('useCasesLawyers.cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/demo"
                className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {t('useCasesLawyers.cta.tryFreeDemo')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('useCasesLawyers.cta.viewPricing')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
