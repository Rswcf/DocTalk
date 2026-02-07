"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../i18n';

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <section className="max-w-6xl mx-auto px-6 py-24 md:py-32">
      <div className="max-w-4xl mx-auto text-center">
        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-zinc-900 dark:text-zinc-50 leading-[1.1] tracking-tight">
          {t('landing.headline').split('\n').map((line: string, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 font-normal">
          {t('landing.subtitle')}
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-colors"
          >
            {t('landing.cta.demo')}
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            {t('landing.cta.howItWorks')}
          </Link>
        </div>
      </div>
    </section>
  );
}
