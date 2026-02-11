"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

export default function FinalCTA() {
  const { t } = useLocale();

  return (
    <ScrollReveal>
      <section className="py-20 px-6 bg-zinc-50 dark:bg-zinc-900/50 relative overflow-hidden">
        {/* Dot pattern background */}
        <div className="dot-pattern absolute inset-0 opacity-40 dark:opacity-20" aria-hidden="true" />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="font-display font-medium text-3xl md:text-4xl tracking-tight text-zinc-900 dark:text-zinc-50 mb-4 text-balance">
            {t('landing.finalCta.title')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            {t('landing.finalCta.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg font-medium shadow-sm hover:shadow-md transition-[box-shadow,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              {t('landing.finalCta.demo')}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              href="?auth=1"
              scroll={false}
              className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:border-accent hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              {t('landing.finalCta.signUp')}
            </Link>
          </div>
        </div>
      </section>
    </ScrollReveal>
  );
}
