"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import ShowcasePlayer from './ShowcasePlayer';

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

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-zinc-900 dark:text-zinc-50 leading-[1.05] tracking-tight text-balance">
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

        {/* Right: ShowcasePlayer in macOS chrome — order-2 desktop, order-2 mobile (stacks below text) */}
        <div className="lg:col-span-2">
          <div className="relative">
            {/* Subtle accent glow */}
            <div
              aria-hidden="true"
              className="glow-accent absolute -inset-4 blur-2xl opacity-50 pointer-events-none"
            />
            <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden bg-zinc-50 dark:bg-zinc-900">
              {/* macOS window chrome — compact */}
              <div className="flex items-center px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-zinc-200 dark:bg-zinc-700 rounded-md px-3 py-0.5">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-300 select-none">doctalk.site</span>
                  </div>
                </div>
                <div className="w-[40px]" aria-hidden="true" />
              </div>
              <div className="aspect-video relative">
                <ShowcasePlayer />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
