"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import ComparisonTable from '../../../components/seo/ComparisonTable';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import { useLocale } from '../../../i18n';
import { FileText, Languages, Zap, Shield, DollarSign, Quote } from 'lucide-react';

export default function NotebooklmClient() {
  const { t } = useLocale();

  const features = [
    { name: t('compareNotebooklm.table.supportedFormats'), doctalk: t('compareNotebooklm.table.doctalk.supportedFormats'), competitor: t('compareNotebooklm.table.competitor.supportedFormats') },
    { name: t('compareNotebooklm.table.citationHighlighting'), doctalk: t('compareNotebooklm.table.doctalk.citationHighlighting'), competitor: t('compareNotebooklm.table.competitor.citationHighlighting') },
    { name: t('compareNotebooklm.table.multiSourceNotebooks'), doctalk: false, competitor: true },
    { name: t('compareNotebooklm.table.audioPodcast'), doctalk: false, competitor: true },
    { name: t('compareNotebooklm.table.interfaceLanguages'), doctalk: t('compareNotebooklm.table.doctalk.interfaceLanguages'), competitor: t('compareNotebooklm.table.competitor.interfaceLanguages') },
    { name: t('compareNotebooklm.table.requiresGoogle'), doctalk: false, competitor: true },
    { name: t('compareNotebooklm.table.noSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareNotebooklm.table.freeTier'), doctalk: t('compareNotebooklm.table.doctalk.freeTier'), competitor: t('compareNotebooklm.table.competitor.freeTier') },
    { name: t('compareNotebooklm.table.multipleAiModes'), doctalk: t('compareNotebooklm.table.doctalk.multipleAiModes'), competitor: t('compareNotebooklm.table.competitor.multipleAiModes') },
    { name: t('compareNotebooklm.table.dataEncryption'), doctalk: t('compareNotebooklm.table.doctalk.dataEncryption'), competitor: t('compareNotebooklm.table.competitor.dataEncryption') },
  ];

  const faqItems = [
    {
      question: t('compareNotebooklm.faq.q1'),
      answer: t('compareNotebooklm.faq.a1'),
    },
    {
      question: t('compareNotebooklm.faq.q2'),
      answer: t('compareNotebooklm.faq.a2'),
    },
    {
      question: t('compareNotebooklm.faq.q3'),
      answer: t('compareNotebooklm.faq.a3'),
    },
    {
      question: t('compareNotebooklm.faq.q4'),
      answer: t('compareNotebooklm.faq.a4'),
    },
    {
      question: t('compareNotebooklm.faq.q5'),
      answer: t('compareNotebooklm.faq.a5'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareNotebooklm.breadcrumb.home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/compare" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareNotebooklm.breadcrumb.compare')}</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{t('compareNotebooklm.breadcrumb.current')}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            {t('compareNotebooklm.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareNotebooklm.heroDescription')}
          </p>
          <ArticleMeta author={t('compareNotebooklm.author')} published="2026-02-18" className="mt-6" />
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              {t('compareNotebooklm.quickComparison')}
            </h2>
            <ComparisonTable features={features} competitorName="NotebookLM" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('compareNotebooklm.whatIsDocTalk')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareNotebooklm.whatIsDocTalkDescription')}
          </p>
        </section>

        {/* What Is NotebookLM? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('compareNotebooklm.whatIsNotebookLM')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareNotebooklm.whatIsNotebookLMDescription')}
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10">
            {t('compareNotebooklm.featureByFeature')}
          </h2>

          {/* Document Format Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareNotebooklm.feature.formatSupport')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.feature.formatSupportP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareNotebooklm.feature.formatSupportP2Pre')}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareNotebooklm.feature.formatSupportLink')}
              </Link>.
            </p>
          </div>

          {/* AI Answer Quality & Citations */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Quote className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareNotebooklm.feature.citations')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.feature.citationsP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareNotebooklm.feature.citationsP2Pre')}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareNotebooklm.feature.citationsLink')}
              </Link>.
            </p>
          </div>

          {/* Language Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareNotebooklm.feature.languages')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.feature.languagesP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareNotebooklm.feature.languagesP2Pre')}
              <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareNotebooklm.feature.languagesLink')}
              </Link>.
            </p>
          </div>

          {/* Pricing & Free Tier */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareNotebooklm.feature.pricing')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.feature.pricingP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareNotebooklm.feature.pricingP2Pre')}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('compareNotebooklm.feature.pricingDemoLink')}</Link>
              {t('compareNotebooklm.feature.pricingP2Mid')}
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('compareNotebooklm.feature.pricingPricingLink')}</Link>.
            </p>
          </div>

          {/* Performance & Speed */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareNotebooklm.feature.performance')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.feature.performanceP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareNotebooklm.feature.performanceP2')}
            </p>
          </div>

          {/* Security & Privacy */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareNotebooklm.feature.security')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.feature.securityP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareNotebooklm.feature.securityP2')}
            </p>
          </div>
        </section>

        {/* Who Should Choose DocTalk? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareNotebooklm.whoDocTalk')}
            </h2>
            <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareNotebooklm.whoDocTalk.item1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareNotebooklm.whoDocTalk.item2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareNotebooklm.whoDocTalk.item3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareNotebooklm.whoDocTalk.item4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareNotebooklm.whoDocTalk.item5')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose NotebookLM? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            {t('compareNotebooklm.whoNotebookLM')}
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareNotebooklm.whoNotebookLM.item1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareNotebooklm.whoNotebookLM.item2')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareNotebooklm.whoNotebookLM.item3')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareNotebooklm.whoNotebookLM.item4')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareNotebooklm.whoNotebookLM.item5')}</span>
            </li>
          </ul>
        </section>

        {/* Verdict */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareNotebooklm.verdict')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.verdictP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareNotebooklm.verdictP2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
              {t('compareNotebooklm.verdictP3Pre')}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareNotebooklm.verdictDemoLink')}
              </Link>
              {t('compareNotebooklm.verdictP3Post')}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('compareNotebooklm.faqTitle')}
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('compareNotebooklm.relatedPages')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/features/citations', label: t('compareNotebooklm.related.citations') },
                { href: '/features/multi-format', label: t('compareNotebooklm.related.multiFormat') },
                { href: '/features/multilingual', label: t('compareNotebooklm.related.multilingual') },
                { href: '/demo', label: t('compareNotebooklm.related.freeDemo') },
                { href: '/alternatives/notebooklm', label: t('compareNotebooklm.related.notebooklmAlternatives') },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <CTABanner
          variant="highlight"
          title={t('compareNotebooklm.ctaTitle')}
          description={t('compareNotebooklm.ctaDescription')}
          buttonText={t('compareNotebooklm.ctaButton')}
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
