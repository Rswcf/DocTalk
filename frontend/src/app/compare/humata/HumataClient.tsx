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

export default function HumataClient() {
  const { t } = useLocale();

  const features = [
    { name: t('compareHumata.featureSupportedFormats'), doctalk: t('compareHumata.featureSupportedFormatsDocTalk'), competitor: t('compareHumata.featureSupportedFormatsCompetitor') },
    { name: t('compareHumata.featureCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('compareHumata.featureVideoSupport'), doctalk: false, competitor: true },
    { name: t('compareHumata.featureTeamCollaboration'), doctalk: false, competitor: true },
    { name: t('compareHumata.featureInterfaceLanguages'), doctalk: t('compareHumata.featureInterfaceLanguagesDocTalk'), competitor: t('compareHumata.featureInterfaceLanguagesCompetitor') },
    { name: t('compareHumata.featureNoSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareHumata.featureFreeTier'), doctalk: t('compareHumata.featureFreeTierDocTalk'), competitor: t('compareHumata.featureFreeTierCompetitor') },
    { name: t('compareHumata.featureMultipleAIModes'), doctalk: t('compareHumata.featureMultipleAIModesDocTalk'), competitor: t('compareHumata.featureMultipleAIModesCompetitor') },
    { name: t('compareHumata.featureStartingPrice'), doctalk: t('compareHumata.featureStartingPriceDocTalk'), competitor: t('compareHumata.featureStartingPriceCompetitor') },
    { name: t('compareHumata.featureDarkMode'), doctalk: true, competitor: false },
  ];

  const faqItems = [
    {
      question: t('compareHumata.faq1Question'),
      answer: t('compareHumata.faq1Answer'),
    },
    {
      question: t('compareHumata.faq2Question'),
      answer: t('compareHumata.faq2Answer'),
    },
    {
      question: t('compareHumata.faq3Question'),
      answer: t('compareHumata.faq3Answer'),
    },
    {
      question: t('compareHumata.faq4Question'),
      answer: t('compareHumata.faq4Answer'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareHumata.breadcrumbHome')}</Link>
            <span className="mx-2">/</span>
            <Link href="/compare" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareHumata.breadcrumbCompare')}</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{t('compareHumata.breadcrumbCurrent')}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            {t('compareHumata.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareHumata.heroDescription')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" className="mt-6" />
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              {t('compareHumata.quickComparison')}
            </h2>
            <ComparisonTable features={features} competitorName="Humata" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('compareHumata.whatIsDocTalkTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareHumata.whatIsDocTalkDescription')}
          </p>
        </section>

        {/* What Is Humata? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('compareHumata.whatIsHumataTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareHumata.whatIsHumataDescription')}
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10">
            {t('compareHumata.featureByFeatureTitle')}
          </h2>

          {/* Document Format Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareHumata.documentFormatTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.documentFormatCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareHumata.documentFormatDocTalk')}{' '}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareHumata.multiFormatLink')}
              </Link>.
            </p>
          </div>

          {/* AI Answer Quality & Citations */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Quote className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareHumata.citationsTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.citationsCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareHumata.citationsDocTalk')}{' '}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareHumata.citationHighlightingLink')}
              </Link>.
            </p>
          </div>

          {/* Language Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareHumata.languageSupportTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.languageSupportCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareHumata.languageSupportDocTalk')}{' '}
              <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareHumata.multilingualLink')}
              </Link>.
            </p>
          </div>

          {/* Pricing & Free Tier */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareHumata.pricingTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.pricingCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareHumata.pricingDocTalkPart1')}{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('compareHumata.noSignupDemoLink')}</Link>.
              {' '}{t('compareHumata.pricingDocTalkPart2')}{' '}
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareHumata.pricingDetailsLink')}
              </Link>.
            </p>
          </div>

          {/* Performance & Speed */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareHumata.performanceTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.performanceCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareHumata.performanceDocTalk')}
            </p>
          </div>

          {/* Security & Privacy */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareHumata.securityTitle')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.securityCompetitor')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareHumata.securityDocTalk')}
            </p>
          </div>
        </section>

        {/* Who Should Choose DocTalk? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareHumata.whoDocTalkTitle')}
            </h2>
            <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareHumata.whoDocTalk1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareHumata.whoDocTalk2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareHumata.whoDocTalk3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareHumata.whoDocTalk4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareHumata.whoDocTalk5')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose Humata? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            {t('compareHumata.whoHumataTitle')}
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareHumata.whoHumata1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareHumata.whoHumata2')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareHumata.whoHumata3')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareHumata.whoHumata4')}</span>
            </li>
          </ul>
        </section>

        {/* Verdict */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareHumata.verdictTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.verdictParagraph1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareHumata.verdictParagraph2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
              {t('compareHumata.verdictParagraph3')}{' '}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareHumata.tryDocTalkLink')}
              </Link>{' '}
              {t('compareHumata.verdictParagraph3End')}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('compareHumata.faqTitle')}
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('compareHumata.relatedPages')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/features/citations', label: t('compareHumata.linkCitationHighlighting') },
                { href: '/features/multilingual', label: t('compareHumata.linkMultilingual') },
                { href: '/demo', label: t('compareHumata.linkFreeDemo') },
                { href: '/pricing', label: t('compareHumata.linkPricing') },
                { href: '/alternatives/humata', label: t('compareHumata.linkHumataAlternatives') },
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
          title={t('compareHumata.ctaTitle')}
          description={t('compareHumata.ctaDescription')}
          buttonText={t('compareHumata.ctaButton')}
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
