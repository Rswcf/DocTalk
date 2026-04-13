"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import ComparisonTable from '../../../components/seo/ComparisonTable';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import { FileText, Languages, Zap, Shield, DollarSign, Quote } from 'lucide-react';
import { useLocale } from '../../../i18n';

export default function PdfaiClient() {
  const { t } = useLocale();

  const features = [
    { name: t('comparePdfai.featureSupportedFormats'), doctalk: t('comparePdfai.featureSupportedFormatsDocTalk'), competitor: t('comparePdfai.featureSupportedFormatsCompetitor') },
    { name: t('comparePdfai.featureCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureInterfaceLanguages'), doctalk: t('comparePdfai.featureInterfaceLanguagesDocTalk'), competitor: t('comparePdfai.featureInterfaceLanguagesCompetitor') },
    { name: t('comparePdfai.featureNoSignupDemo'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureMultipleAIModes'), doctalk: t('comparePdfai.featureMultipleAIModesDocTalk'), competitor: t('comparePdfai.featureMultipleAIModesCompetitor') },
    { name: t('comparePdfai.featureFreeTier'), doctalk: t('comparePdfai.featureFreeTierDocTalk'), competitor: t('comparePdfai.featureFreeTierCompetitor') },
    { name: t('comparePdfai.featureWebUrlIngestion'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureDarkMode'), doctalk: true, competitor: false },
    { name: t('comparePdfai.featureDataEncryption'), doctalk: t('comparePdfai.featureDataEncryptionDocTalk'), competitor: t('comparePdfai.featureDataEncryptionCompetitor') },
    { name: t('comparePdfai.featureActiveDevelopment'), doctalk: t('comparePdfai.featureActiveDevelopmentDocTalk'), competitor: t('comparePdfai.featureActiveDevelopmentCompetitor') },
  ];

  const faqItems = [
    {
      question: t('comparePdfai.faq1Question'),
      answer: t('comparePdfai.faq1Answer'),
    },
    {
      question: t('comparePdfai.faq2Question'),
      answer: t('comparePdfai.faq2Answer'),
    },
    {
      question: t('comparePdfai.faq3Question'),
      answer: t('comparePdfai.faq3Answer'),
    },
    {
      question: t('comparePdfai.faq4Question'),
      answer: t('comparePdfai.faq4Answer'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('comparePdfai.breadcrumbHome')}</Link>
            <span className="mx-2">/</span>
            <Link href="/compare" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('comparePdfai.breadcrumbCompare')}</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{t('comparePdfai.breadcrumbCurrent')}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            {t('comparePdfai.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('comparePdfai.heroDescription')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" className="mt-6" />
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              {t('comparePdfai.quickComparison')}
            </h2>
            <ComparisonTable features={features} competitorName="PDF.ai" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('comparePdfai.whatIsDocTalkTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('comparePdfai.whatIsDocTalkDescription')}
          </p>
        </section>

        {/* What Is PDF.ai? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('comparePdfai.whatIsPdfaiTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <a href="https://pdf.ai" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">PDF.ai</a>{' '}
              {t('comparePdfai.whatIsPdfaiDescription')}{' '}
              It leverages <a href="https://arxiv.org/abs/2005.11401" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">retrieval-augmented generation</a> to provide cited answers from your documents.
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10">
            {t('comparePdfai.featureByFeatureTitle')}
          </h2>

          {/* Document Format Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('comparePdfai.documentFormatTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.documentFormatCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('comparePdfai.documentFormatDocTalk')}{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('comparePdfai.multiFormatLink')}
              </Link>.
            </p>
          </div>

          {/* AI Answer Quality & Citations */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Quote className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('comparePdfai.citationsTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.citationsCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('comparePdfai.citationsDocTalk')}{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('comparePdfai.citationHighlightingLink')}
              </Link>.
            </p>
          </div>

          {/* Language Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('comparePdfai.languageSupportTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.languageSupportCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('comparePdfai.languageSupportDocTalk')}
            </p>
          </div>

          {/* Pricing & Free Tier */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('comparePdfai.pricingTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.pricingCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('comparePdfai.pricingDocTalkPart1')}{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('comparePdfai.noSignupDemoLink')}
              </Link>. {t('comparePdfai.pricingDocTalkPart2')}{' '}
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('comparePdfai.fullPricingLink')}
              </Link>.
            </p>
          </div>

          {/* Performance & Speed */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('comparePdfai.performanceTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.performanceCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('comparePdfai.performanceDocTalk')}
            </p>
          </div>

          {/* Security & Privacy */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('comparePdfai.securityTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.securityCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('comparePdfai.securityDocTalk')}
            </p>
          </div>
        </section>

        {/* Who Should Choose DocTalk? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('comparePdfai.whoDocTalkTitle')}
            </h2>
            <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('comparePdfai.whoDocTalk1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('comparePdfai.whoDocTalk2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('comparePdfai.whoDocTalk3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('comparePdfai.whoDocTalk4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('comparePdfai.whoDocTalk5')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose PDF.ai? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            {t('comparePdfai.whoPdfaiTitle')}
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('comparePdfai.whoPdfai1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('comparePdfai.whoPdfai2')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('comparePdfai.whoPdfai3')}</span>
            </li>
          </ul>
        </section>

        {/* Verdict */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('comparePdfai.verdictTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.verdictParagraph1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('comparePdfai.verdictParagraph2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
              {t('comparePdfai.verdictParagraph3')}{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('comparePdfai.tryFreeDemoLink')}
              </Link>{' '}
              {t('comparePdfai.verdictParagraph3End')}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('comparePdfai.faqTitle')}
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('comparePdfai.relatedPages')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/features/citations', label: t('comparePdfai.linkCitationHighlighting') },
                { href: '/features/multi-format', label: t('comparePdfai.linkMultiFormat') },
                { href: '/demo', label: t('comparePdfai.linkFreeDemo') },
                { href: '/pricing', label: t('comparePdfai.linkPricing') },
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
          title={t('comparePdfai.ctaTitle')}
          description={t('comparePdfai.ctaDescription')}
          buttonText={t('comparePdfai.ctaButton')}
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
