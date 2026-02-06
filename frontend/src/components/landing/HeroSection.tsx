"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../i18n';

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="max-w-3xl">
        {/* Badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-block w-2.5 h-2.5 bg-zinc-900 dark:bg-zinc-100" />
          <span className="text-xs font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            {t('landing.badge')}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-zinc-900 dark:text-zinc-50 leading-[1.1] tracking-tight">
          {t('landing.headline').split('\n').map((line: string, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-2xl md:text-3xl text-zinc-400 dark:text-zinc-500 font-medium">
          {t('landing.subtitle')}
        </p>

        {/* Description */}
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400 max-w-lg leading-relaxed">
          {t('landing.description')}
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="inline-flex items-center px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-200"
          >
            {t('landing.cta.demo')}
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200"
          >
            {t('landing.cta.howItWorks')}
          </Link>
        </div>
      </div>
    </section>
  );
}
