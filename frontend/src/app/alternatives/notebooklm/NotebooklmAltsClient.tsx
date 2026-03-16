"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import ArticleMeta from '../../../components/seo/ArticleMeta';
import FAQSection from '../../../components/seo/FAQSection';
import CTABanner from '../../../components/seo/CTABanner';
import { Award, Check } from 'lucide-react';
import { useLocale } from '../../../i18n';

export default function NotebooklmAltsClient() {
  const { t } = useLocale();

  const faqItems = [
    {
      question: t('altsNotebooklm.faq1Question'),
      answer: t('altsNotebooklm.faq1Answer'),
    },
    {
      question: t('altsNotebooklm.faq2Question'),
      answer: t('altsNotebooklm.faq2Answer'),
    },
    {
      question: t('altsNotebooklm.faq3Question'),
      answer: t('altsNotebooklm.faq3Answer'),
    },
    {
      question: t('altsNotebooklm.faq4Question'),
      answer: t('altsNotebooklm.faq4Answer'),
    },
    {
      question: t('altsNotebooklm.faq5Question'),
      answer: t('altsNotebooklm.faq5Answer'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <nav className="text-sm text-zinc-500 dark:text-zinc-300 mb-8">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('altsNotebooklm.breadcrumbHome')}</Link>
            <span className="mx-2">/</span>
            <Link href="/alternatives" className="hover:text-zinc-700 dark:hover:text-zinc-300">{t('altsNotebooklm.breadcrumbAlternatives')}</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">{t('altsNotebooklm.breadcrumbNotebooklm')}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
            {t('altsNotebooklm.heroTitle')}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('altsNotebooklm.heroDescription')}
          </p>
          <ArticleMeta author="DocTalk Team" published="2026-02-18" className="mt-6" />
        </section>

        {/* #1 DocTalk */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold">1</span>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {t('altsNotebooklm.alt1Title')}
              </h2>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{t('altsNotebooklm.bestOverall')}</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsNotebooklm.alt1Desc1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsNotebooklm.alt1Desc2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsNotebooklm.alt1Desc3Pre')}{' '}
              <Link href="/compare/notebooklm" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('altsNotebooklm.alt1CompareLink')}
              </Link>.
            </p>
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">{t('altsNotebooklm.keyAdvantages')}</h3>
              <ul className="space-y-1.5">
                {[
                  t('altsNotebooklm.adv1'),
                  t('altsNotebooklm.adv2'),
                  t('altsNotebooklm.adv3'),
                  t('altsNotebooklm.adv4'),
                  t('altsNotebooklm.adv5'),
                  t('altsNotebooklm.adv6'),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* #2 ChatPDF */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">2</span>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t('altsNotebooklm.alt2Title')}
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsNotebooklm.alt2Desc1')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsNotebooklm.alt2Desc2')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm">
            <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt2BestFor')}
          </p>
        </section>

        {/* #3 AskYourPDF */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">3</span>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {t('altsNotebooklm.alt3Title')}
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsNotebooklm.alt3Desc1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsNotebooklm.alt3Desc2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">
              <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt3BestFor')}
            </p>
          </div>
        </section>

        {/* #4 Humata */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">4</span>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t('altsNotebooklm.alt4Title')}
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsNotebooklm.alt4Desc1')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsNotebooklm.alt4Desc2')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm">
            <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt4BestFor')}
          </p>
        </section>

        {/* #5 Consensus */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">5</span>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {t('altsNotebooklm.alt5Title')}
              </h2>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsNotebooklm.alt5Desc1')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              {t('altsNotebooklm.alt5Desc2')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300 text-sm">
              <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt5BestFor')}
            </p>
          </div>
        </section>

        {/* #6 Elicit */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold">6</span>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t('altsNotebooklm.alt6Title')}
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsNotebooklm.alt6Desc1')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
            {t('altsNotebooklm.alt6Desc2')}
          </p>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm">
            <strong>{t('altsNotebooklm.bestFor')}</strong> {t('altsNotebooklm.alt6BestFor')}
          </p>
        </section>

        {/* How to Choose */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-6">
              {t('altsNotebooklm.chooseTitle')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
              {t('altsNotebooklm.chooseDescription')}
            </p>
            <div className="space-y-4">
              {[
                { need: t('altsNotebooklm.chooseNeed1'), pick: 'DocTalk', href: '/demo' },
                { need: t('altsNotebooklm.chooseNeed2'), pick: 'ChatPDF', href: '/compare/chatpdf' },
                { need: t('altsNotebooklm.chooseNeed3'), pick: 'AskYourPDF', href: '/compare/askyourpdf' },
                { need: t('altsNotebooklm.chooseNeed4'), pick: 'Humata', href: '/compare/humata' },
                { need: t('altsNotebooklm.chooseNeed5'), pick: 'Consensus', href: '/alternatives' },
                { need: t('altsNotebooklm.chooseNeed6'), pick: 'Elicit', href: '/alternatives' },
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
            {t('altsNotebooklm.faqTitle')}
          </h2>
          <FAQSection items={faqItems} />
        </section>

        {/* Internal Links */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('altsNotebooklm.relatedPages')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: '/compare/notebooklm', label: t('altsNotebooklm.linkVsNotebooklm') },
                { href: '/features/citations', label: t('altsNotebooklm.linkCitations') },
                { href: '/features/multilingual', label: t('altsNotebooklm.linkMultilingual') },
                { href: '/demo', label: t('altsNotebooklm.linkFreeDemo') },
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
          title={t('altsNotebooklm.ctaTitle')}
          description={t('altsNotebooklm.ctaDescription')}
          buttonText={t('altsNotebooklm.ctaButton')}
          href="/demo"
        />
      </main>
      <Footer />
    </div>
  );
}
