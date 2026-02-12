"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <ScrollReveal direction="up" delay={0}>
      <section className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 overflow-hidden">
        {/* Subtle dot-pattern background */}
        <div
          aria-hidden="true"
          className="dot-pattern absolute inset-0 opacity-[0.4] pointer-events-none"
        />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge pill */}
          <span className="inline-block bg-accent-light text-accent text-xs font-medium tracking-widest uppercase px-3 py-1 rounded-full mb-6">
            {t('landing.badge')}
          </span>

          {/* Headline */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-48 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,var(--accent-light),transparent_70%)] opacity-80 pointer-events-none"
            />
            <h1 className="relative text-5xl md:text-6xl lg:text-7xl font-display font-semibold text-zinc-900 dark:text-zinc-50 leading-[1.1] tracking-tight text-balance">
              {t('landing.headline').split('\n').map((line: string, i: number) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
            </h1>
          </div>

          {/* Subtitle */}
          <p className="mt-4 text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 font-normal">
            {t('landing.subtitle')}
          </p>

          {/* Description */}
          <p className="mt-3 max-w-2xl mx-auto text-base md:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('landing.description')}
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg font-medium shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
            >
              {t('landing.cta.demo')}
              <ArrowRight aria-hidden="true" size={18} className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="?auth=1"
              className="rounded-full border border-zinc-300 dark:border-zinc-600 px-6 py-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('hero.signUpFree')}
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:border-accent hover:text-accent dark:hover:border-accent dark:hover:text-accent transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
            >
              {t('landing.cta.howItWorks')}
            </Link>
          </div>
        </div>
      </section>
    </ScrollReveal>
  );
}
