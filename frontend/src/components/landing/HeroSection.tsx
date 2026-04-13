"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import HeroArtifact from './HeroArtifact';

export default function HeroSection() {
  const { t } = useLocale();

  return (
    <section className="relative max-w-7xl mx-auto px-6 py-20 md:py-28 overflow-hidden">
      <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
        {/* Left: text — order-1 desktop, order-1 mobile */}
        <div className="lg:col-span-3 text-center lg:text-left">
          {/* Badge pill */}
          <span className="inline-block bg-accent-light text-accent text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6">
            {t('landing.badge')}
          </span>

          {/* Headline — Instrument Serif (font-serif) for editorial
              "thinking tool" feel per 30-agent typography research. Weight
              400 (the face's only cut) + negative tracking at scale. CJK
              locales fall back to system serif via the font stack. */}
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-normal text-zinc-900 dark:text-zinc-50 leading-[1.02] tracking-[-0.02em] text-balance">
            {t('landing.headline').split('\n').map((line: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h1>

          {/* Single supporting line — keep description, drop subtitle */}
          <p className="mt-5 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl lg:max-w-none">
            {t('landing.description')}
          </p>

          {/* CTAs: ONE primary + ONE text link */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 justify-center lg:justify-start">
            <Link
              href="/demo"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg font-semibold shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
            >
              {t('landing.cta.demo')}
              <ArrowRight aria-hidden="true" size={18} className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#auth"
              scroll={false}
              className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-accent dark:hover:text-accent transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm"
            >
              {t('hero.signUpFree')}
              <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </div>
        </div>

        {/* Right: HeroArtifact (static product mock) — order-2 desktop, order-2 mobile (stacks below text) */}
        <div className="lg:col-span-2">
          <HeroArtifact />
        </div>
      </div>
    </section>
  );
}
