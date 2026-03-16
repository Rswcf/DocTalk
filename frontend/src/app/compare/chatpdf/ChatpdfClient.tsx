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

export default function ChatpdfClient() {
  const { t } = useLocale();

  const features = [
    { name: t('compareChatpdf.table.supportedFormats'), doctalk: t('compareChatpdf.table.doctalk.supportedFormats'), competitor: t('compareChatpdf.table.competitor.supportedFormats') },
    { name: t('compareChatpdf.table.citationHighlighting'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.interfaceLanguages'), doctalk: t('compareChatpdf.table.doctalk.interfaceLanguages'), competitor: t('compareChatpdf.table.competitor.interfaceLanguages') },
    { name: t('compareChatpdf.table.freeTier'), doctalk: t('compareChatpdf.table.doctalk.freeTier'), competitor: t('compareChatpdf.table.competitor.freeTier') },
    { name: t('compareChatpdf.table.noSignupDemo'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.multipleAiModels'), doctalk: t('compareChatpdf.table.doctalk.multipleAiModels'), competitor: t('compareChatpdf.table.competitor.multipleAiModels') },
    { name: t('compareChatpdf.table.docSizeLimit'), doctalk: t('compareChatpdf.table.doctalk.docSizeLimit'), competitor: t('compareChatpdf.table.competitor.docSizeLimit') },
    { name: t('compareChatpdf.table.darkMode'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.webUrlIngestion'), doctalk: true, competitor: false },
    { name: t('compareChatpdf.table.customInstructions'), doctalk: t('compareChatpdf.table.doctalk.customInstructions'), competitor: false },
  ];

  const faqItems = [
    {
      question: t('compareChatpdf.faq.q1'),
      answer: t('compareChatpdf.faq.a1'),
    },
    {
      question: t('compareChatpdf.faq.q2'),
      answer: t('compareChatpdf.faq.a2'),
    },
    {
      question: t('compareChatpdf.faq.q3'),
      answer: t('compareChatpdf.faq.a3'),
    },
    {
      question: t('compareChatpdf.faq.q4'),
      answer: t('compareChatpdf.faq.a4'),
    },
    {
      question: t('compareChatpdf.faq.q5'),
      answer: t('compareChatpdf.faq.a5'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareChatpdf.breadcrumb.home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/compare" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('compareChatpdf.breadcrumb.compare')}</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{t('compareChatpdf.breadcrumb.current')}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
            {t('compareChatpdf.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareChatpdf.heroDescription')}
          </p>
          <ArticleMeta author={t('compareChatpdf.author')} published="2026-02-18" className="mt-6" />
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              {t('compareChatpdf.quickComparison')}
            </h2>
            <ComparisonTable features={features} competitorName="ChatPDF" />
          </div>
        </section>

        {/* What Is DocTalk? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
            {t('compareChatpdf.whatIsDocTalk')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('compareChatpdf.whatIsDocTalkDescription')}
          </p>
        </section>

        {/* What Is ChatPDF? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
              {t('compareChatpdf.whatIsChatPDF')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareChatpdf.whatIsChatPDFDescription')}
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-10">
            {t('compareChatpdf.featureByFeature')}
          </h2>

          {/* Document Format Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareChatpdf.feature.formatSupport')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.feature.formatSupportP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareChatpdf.feature.formatSupportP2Pre')}
              <Link href="/features/multi-format" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareChatpdf.feature.formatSupportLink')}
              </Link>
              {t('compareChatpdf.feature.formatSupportP2Post')}
            </p>
          </div>

          {/* AI Answer Quality & Citations */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Quote className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareChatpdf.feature.citations')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.feature.citationsP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareChatpdf.feature.citationsP2Pre')}
              <Link href="/features/citations" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareChatpdf.feature.citationsLink')}
              </Link>.
            </p>
          </div>

          {/* Language Support */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareChatpdf.feature.languages')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.feature.languagesP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareChatpdf.feature.languagesP2Pre')}
              <Link href="/features/multilingual" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareChatpdf.feature.languagesLink')}
              </Link>
              {t('compareChatpdf.feature.languagesP2Post')}
            </p>
          </div>

          {/* Pricing & Free Tier */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareChatpdf.feature.pricing')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.feature.pricingP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareChatpdf.feature.pricingP2Pre')}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('compareChatpdf.feature.pricingDemoLink')}</Link>
              {t('compareChatpdf.feature.pricingP2Mid')}
              <Link href="/pricing" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareChatpdf.feature.pricingLink')}
              </Link>.
            </p>
          </div>

          {/* Performance & Speed */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareChatpdf.feature.performance')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.feature.performanceP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareChatpdf.feature.performanceP2')}
            </p>
          </div>

          {/* Security & Privacy */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {t('compareChatpdf.feature.security')}
              </h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.feature.securityP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {t('compareChatpdf.feature.securityP2')}
            </p>
          </div>
        </section>

        {/* Who Should Choose DocTalk? */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareChatpdf.whoDocTalk')}
            </h2>
            <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareChatpdf.whoDocTalk.item1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareChatpdf.whoDocTalk.item2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareChatpdf.whoDocTalk.item3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareChatpdf.whoDocTalk.item4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{t('compareChatpdf.whoDocTalk.item5')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Who Should Choose ChatPDF? */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            {t('compareChatpdf.whoChatPDF')}
          </h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareChatpdf.whoChatPDF.item1')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareChatpdf.whoChatPDF.item2')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareChatpdf.whoChatPDF.item3')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>{t('compareChatpdf.whoChatPDF.item4')}</span>
            </li>
          </ul>
        </section>

        {/* Verdict */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('compareChatpdf.verdict')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.verdictP1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('compareChatpdf.verdictP2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
              {t('compareChatpdf.verdictP3Pre')}
              <Link href="/demo" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('compareChatpdf.verdictDemoLink')}
              </Link>
              {t('compareChatpdf.verdictP3Post')}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('compareChatpdf.faqTitle')}
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('compareChatpdf.relatedPages')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/features/citations', label: t('compareChatpdf.related.citations') },
                { href: '/features/multi-format', label: t('compareChatpdf.related.multiFormat') },
                { href: '/features/multilingual', label: t('compareChatpdf.related.multilingual') },
                { href: '/demo', label: t('compareChatpdf.related.freeDemo') },
                { href: '/pricing', label: t('compareChatpdf.related.pricing') },
                { href: '/alternatives/chatpdf', label: t('compareChatpdf.related.chatpdfAlternatives') },
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
          title={t('compareChatpdf.ctaTitle')}
          description={t('compareChatpdf.ctaDescription')}
          buttonText={t('compareChatpdf.ctaButton')}
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
