"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import ComparisonTable from '../../../components/seo/ComparisonTable';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import { Award, Check } from 'lucide-react';
import { useLocale } from '../../../i18n';

export default function ChatpdfAltsClient() {
  const { t } = useLocale();

  const quickCompare = [
    { name: t('altsChatpdf.tableFileFormats'), doctalk: t('altsChatpdf.table7Formats'), competitor: t('altsChatpdf.tablePdfOnly') },
    { name: t('altsChatpdf.tableCitationHighlighting'), doctalk: true, competitor: false },
    { name: t('altsChatpdf.tableLanguages'), doctalk: '11', competitor: '1' },
    { name: t('altsChatpdf.tableFreeTier'), doctalk: t('altsChatpdf.tableFreeTierDoctalk'), competitor: t('altsChatpdf.tableFreeTierChatpdf') },
    { name: t('altsChatpdf.tableStartingPrice'), doctalk: '$9.99/mo', competitor: '$19.99/mo' },
  ];

  const faqItems = [
    {
      question: t('altsChatpdf.faq1Question'),
      answer: t('altsChatpdf.faq1Answer'),
    },
    {
      question: t('altsChatpdf.faq2Question'),
      answer: t('altsChatpdf.faq2Answer'),
    },
    {
      question: t('altsChatpdf.faq3Question'),
      answer: t('altsChatpdf.faq3Answer'),
    },
    {
      question: t('altsChatpdf.faq4Question'),
      answer: t('altsChatpdf.faq4Answer'),
    },
    {
      question: t('altsChatpdf.faq5Question'),
      answer: t('altsChatpdf.faq5Answer'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('altsChatpdf.breadcrumbHome')}</Link>
            <span className="mx-2">/</span>
            <Link href="/alternatives" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('altsChatpdf.breadcrumbAlternatives')}</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{t('altsChatpdf.breadcrumbChatpdf')}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            {t('altsChatpdf.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('altsChatpdf.heroDescription')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" className="mt-6" />
        </section>

        {/* Quick Comparison Table */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
              {t('altsChatpdf.compareTitle')}
            </h2>
            <ComparisonTable features={quickCompare} competitorName="ChatPDF" />
          </div>
        </section>

        {/* #1 DocTalk */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold">1</span>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t('altsChatpdf.alt1Title')}
            </h2>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{t('altsChatpdf.bestOverall')}</span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt1Desc1')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt1Desc2')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt1Desc3Pre')}{' '}
            <Link href="/compare/chatpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('altsChatpdf.alt1CompareLink')}
            </Link>{' '}
            {t('altsChatpdf.alt1Desc3Post')}
          </p>
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">{t('altsChatpdf.keyAdvantages')}</h3>
            <ul className="space-y-1.5">
              {[
                t('altsChatpdf.adv1'),
                t('altsChatpdf.adv2'),
                t('altsChatpdf.adv3'),
                t('altsChatpdf.adv4'),
                t('altsChatpdf.adv5'),
                t('altsChatpdf.adv6'),
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* #2 AskYourPDF */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">2</span>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {t('altsChatpdf.alt2Title')}
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsChatpdf.alt2Desc1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsChatpdf.alt2Desc2Pre')}{' '}
              <Link href="/compare/askyourpdf" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('altsChatpdf.alt2CompareLink')}
              </Link>.
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">
              <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt2BestFor')}
            </p>
          </div>
        </section>

        {/* #3 Humata */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">3</span>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t('altsChatpdf.alt3Title')}
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt3Desc1')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt3Desc2')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm">
            <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt3BestFor')}
          </p>
        </section>

        {/* #4 NotebookLM */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">4</span>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {t('altsChatpdf.alt4Title')}
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsChatpdf.alt4Desc1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsChatpdf.alt4Desc2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">
              <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt4BestFor')}
            </p>
          </div>
        </section>

        {/* #5 PDF.ai */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">5</span>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t('altsChatpdf.alt5Title')}
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt5Desc1')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt5Desc2')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm">
            <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt5BestFor')}
          </p>
        </section>

        {/* #6 ChatDOC */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">6</span>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {t('altsChatpdf.alt6Title')}
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsChatpdf.alt6Desc1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsChatpdf.alt6Desc2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">
              <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt6BestFor')}
            </p>
          </div>
        </section>

        {/* #7 Sharly */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">7</span>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t('altsChatpdf.alt7Title')}
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt7Desc1')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsChatpdf.alt7Desc2')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm">
            <strong>{t('altsChatpdf.bestFor')}</strong> {t('altsChatpdf.alt7BestFor')}
          </p>
        </section>

        {/* How to Choose */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('altsChatpdf.chooseTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
              {t('altsChatpdf.chooseDescription')}
            </p>
            <div className="space-y-4">
              {[
                { need: t('altsChatpdf.chooseNeed1'), pick: 'DocTalk', href: '/demo' },
                { need: t('altsChatpdf.chooseNeed2'), pick: 'AskYourPDF', href: '/compare/askyourpdf' },
                { need: t('altsChatpdf.chooseNeed3'), pick: 'Humata', href: '/compare/humata' },
                { need: t('altsChatpdf.chooseNeed4'), pick: 'NotebookLM', href: '/compare/notebooklm' },
                { need: t('altsChatpdf.chooseNeed5'), pick: 'PDF.ai', href: '/compare/pdf-ai' },
                { need: t('altsChatpdf.chooseNeed6'), pick: 'ChatDOC', href: '/alternatives' },
                { need: t('altsChatpdf.chooseNeed7'), pick: 'Sharly', href: '/alternatives' },
              ].map((item) => (
                <div key={item.need} className="flex items-start gap-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-600 dark:text-zinc-300 text-sm flex-1">{item.need}</span>
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                  >
                    {item.pick}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-8">
            {t('altsChatpdf.faqTitle')}
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('altsChatpdf.relatedPages')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/compare/chatpdf', label: t('altsChatpdf.linkVsChatpdf') },
                { href: '/compare/askyourpdf', label: t('altsChatpdf.linkVsAskyourpdf') },
                { href: '/features/citations', label: t('altsChatpdf.linkCitations') },
                { href: '/features/multi-format', label: t('altsChatpdf.linkMultiFormat') },
                { href: '/demo', label: t('altsChatpdf.linkFreeDemo') },
                { href: '/pricing', label: t('altsChatpdf.linkPricing') },
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
          title={t('altsChatpdf.ctaTitle')}
          description={t('altsChatpdf.ctaDescription')}
          buttonText={t('altsChatpdf.ctaButton')}
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
