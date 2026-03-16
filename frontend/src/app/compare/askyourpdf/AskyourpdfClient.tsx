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

export default function AskyourpdfClient() {
  const { t } = useLocale();

  const features = [
    { name: t('compareAskyourpdf.featureSupportedFormats'), doctalk: t('compareAskyourpdf.featureSupportedFormatsDocTalk'), competitor: t('compareAskyourpdf.featureSupportedFormatsCompetitor') },
    { name: t('compareAskyourpdf.featureCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('compareAskyourpdf.featureChromeExtension'), doctalk: false, competitor: true },
    { name: t('compareAskyourpdf.featureZoteroPlugin'), doctalk: false, competitor: true },
    { name: t('compareAskyourpdf.featureApiAccess'), doctalk: false, competitor: true },
    { name: t('compareAskyourpdf.featureInterfaceLanguages'), doctalk: t('compareAskyourpdf.featureInterfaceLanguagesDocTalk'), competitor: t('compareAskyourpdf.featureInterfaceLanguagesCompetitor') },
    { name: t('compareAskyourpdf.featureNoSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareAskyourpdf.featureMultipleAIModes'), doctalk: t('compareAskyourpdf.featureMultipleAIModesDocTalk'), competitor: t('compareAskyourpdf.featureMultipleAIModesCompetitor') },
    { name: t('compareAskyourpdf.featureFreeTier'), doctalk: t('compareAskyourpdf.featureFreeTierDocTalk'), competitor: t('compareAskyourpdf.featureFreeTierCompetitor') },
    { name: t('compareAskyourpdf.featureDarkMode'), doctalk: true, competitor: false },
  ];

  const faqItems = [
    {
      question: t('compareAskyourpdf.faq1Question'),
      answer: t('compareAskyourpdf.faq1Answer'),
    },
    {
      question: t('compareAskyourpdf.faq2Question'),
      answer: t('compareAskyourpdf.faq2Answer'),
    },
    {
      question: t('compareAskyourpdf.faq3Question'),
      answer: t('compareAskyourpdf.faq3Answer'),
    },
    {
      question: t('compareAskyourpdf.faq4Question'),
      answer: t('compareAskyourpdf.faq4Answer'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareAskyourpdf.breadcrumbHome')}</Link>
            <span className="mx-2">/</span>
            <Link href="/compare" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareAskyourpdf.breadcrumbCompare')}</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{t('compareAskyourpdf.breadcrumbCurrent')}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            {t('compareAskyourpdf.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareAskyourpdf.heroDescription')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" className="mt-6" />
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              {t('compareAskyourpdf.quickComparison')}
            </h2>
            <ComparisonTable features={features} competitorName="AskYourPDF" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('compareAskyourpdf.whatIsDocTalkTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareAskyourpdf.whatIsDocTalkDescription')}
          </p>
        </section>

        {/* What Is AskYourPDF? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('compareAskyourpdf.whatIsAskyourpdfTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareAskyourpdf.whatIsAskyourpdfDescription')}
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10">
            {t('compareAskyourpdf.featureByFeatureTitle')}
          </h2>

          {/* Document Format Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareAskyourpdf.documentFormatTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.documentFormatCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareAskyourpdf.documentFormatDocTalk')}{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareAskyourpdf.multiFormatLink')}
              </Link>{' '}
              {t('compareAskyourpdf.forDetails')}
            </p>
          </div>

          {/* AI Answer Quality & Citations */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Quote className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareAskyourpdf.citationsTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.citationsCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareAskyourpdf.citationsDocTalk')}{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareAskyourpdf.citationHighlightingLink')}
              </Link>.
            </p>
          </div>

          {/* Language Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareAskyourpdf.languageSupportTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.languageSupportCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareAskyourpdf.languageSupportDocTalk')}
            </p>
          </div>

          {/* Pricing & Free Tier */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareAskyourpdf.pricingTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.pricingCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareAskyourpdf.pricingDocTalkPart1')}{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('compareAskyourpdf.noSignupDemoLink')}</Link>{' '}
              {t('compareAskyourpdf.pricingDocTalkPart2')}{' '}
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareAskyourpdf.fullPricingLink')}
              </Link>.
            </p>
          </div>

          {/* Performance & Speed */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareAskyourpdf.performanceTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.performanceCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareAskyourpdf.performanceDocTalk')}
            </p>
          </div>

          {/* Security & Privacy */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareAskyourpdf.securityTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.securityCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareAskyourpdf.securityDocTalk')}
            </p>
          </div>
        </section>

        {/* Who Should Choose DocTalk? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareAskyourpdf.whoDocTalkTitle')}
            </h2>
            <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareAskyourpdf.whoDocTalk1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareAskyourpdf.whoDocTalk2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareAskyourpdf.whoDocTalk3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareAskyourpdf.whoDocTalk4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareAskyourpdf.whoDocTalk5')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose AskYourPDF? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            {t('compareAskyourpdf.whoAskyourpdfTitle')}
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareAskyourpdf.whoAskyourpdf1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareAskyourpdf.whoAskyourpdf2')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareAskyourpdf.whoAskyourpdf3')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareAskyourpdf.whoAskyourpdf4')}</span>
            </li>
          </ul>
        </section>

        {/* Verdict */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareAskyourpdf.verdictTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.verdictParagraph1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareAskyourpdf.verdictParagraph2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
              {t('compareAskyourpdf.verdictParagraph3')}{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareAskyourpdf.tryDocTalkLink')}
              </Link>{' '}
              {t('compareAskyourpdf.verdictParagraph3Mid')}{' '}
              <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareAskyourpdf.chatpdfComparisonLink')}
              </Link>{' '}
              {t('compareAskyourpdf.verdictParagraph3End')}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('compareAskyourpdf.faqTitle')}
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('compareAskyourpdf.relatedPages')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/features/citations', label: t('compareAskyourpdf.linkCitationHighlighting') },
                { href: '/features/multi-format', label: t('compareAskyourpdf.linkMultiFormat') },
                { href: '/demo', label: t('compareAskyourpdf.linkFreeDemo') },
                { href: '/pricing', label: t('compareAskyourpdf.linkPricing') },
                { href: '/compare/chatpdf', label: t('compareAskyourpdf.linkChatpdfComparison') },
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
          title={t('compareAskyourpdf.ctaTitle')}
          description={t('compareAskyourpdf.ctaDescription')}
          buttonText={t('compareAskyourpdf.ctaButton')}
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
