"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

/* ---------- Bespoke per-card visuals ---------- */
/* Each visual shows the actual product concept rather than a generic icon.
   All inline SVG so no extra network requests, no recording needed,
   distinct enough to read at a glance even at thumbnail size. */

function VisualAnswers() {
  return (
    <div aria-hidden="true" className="relative h-24 w-full overflow-hidden rounded-lg bg-gradient-to-br from-indigo-50 to-zinc-50 dark:from-indigo-950/60 dark:to-zinc-800/60 mb-5">
      <div className="absolute inset-0 flex flex-col justify-center px-4 gap-1.5">
        {/* Mock chat reply with text lines + citation pills */}
        <div className="h-1.5 w-3/4 rounded-full bg-zinc-300 dark:bg-zinc-500" />
        <div className="h-1.5 w-5/6 rounded-full bg-zinc-300 dark:bg-zinc-500" />
        <div className="h-1.5 w-2/3 rounded-full bg-zinc-300 dark:bg-zinc-500" />
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-flex items-center justify-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded bg-accent text-accent-foreground">1</span>
          <span className="inline-flex items-center justify-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded bg-accent text-accent-foreground">2</span>
          <span className="inline-flex items-center justify-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded bg-accent/70 text-accent-foreground">3</span>
        </div>
      </div>
    </div>
  );
}

function VisualCitations() {
  return (
    <div aria-hidden="true" className="relative h-24 w-full overflow-hidden rounded-lg bg-gradient-to-br from-indigo-50 to-zinc-50 dark:from-indigo-950/60 dark:to-zinc-800/60 mb-5">
      <div className="absolute inset-0 flex items-center justify-center px-4">
        {/* Mock document page with a highlight stripe + page badge */}
        <div className="relative w-20 h-16 rounded-sm bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 px-2 py-2">
          <div className="space-y-1">
            <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <div className="h-1 w-5/6 rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <div className="h-1.5 w-full rounded-sm bg-amber-200 dark:bg-amber-500/40" />
            <div className="h-1 w-3/4 rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <div className="h-1 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-500" />
          </div>
        </div>
        <div className="ml-2 text-[10px] font-semibold text-accent bg-white dark:bg-zinc-800 border border-accent/30 px-1.5 py-0.5 rounded shadow-sm">
          p. 42
        </div>
      </div>
    </div>
  );
}

function VisualPrivacy() {
  return (
    <div aria-hidden="true" className="relative h-24 w-full overflow-hidden rounded-lg bg-gradient-to-br from-indigo-50 to-zinc-50 dark:from-indigo-950/60 dark:to-zinc-800/60 mb-5">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        {/* Lock icon */}
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">AES-256</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">No training</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Card data ---------- */

const features = [
  { Visual: VisualAnswers, titleKey: 'landing.feature.answers.title', descKey: 'landing.feature.answers.desc' },
  { Visual: VisualCitations, titleKey: 'landing.feature.citations.title', descKey: 'landing.feature.citations.desc' },
  { Visual: VisualPrivacy, titleKey: 'landing.feature.privacy.title', descKey: 'landing.feature.privacy.desc' },
];

export default function FeatureGrid() {
  const { t } = useLocale();

  return (
    <section id="features" className="bg-zinc-50 dark:bg-zinc-900/50 py-24">
      <div className="max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <h2 className="font-semibold tracking-tight text-3xl text-zinc-900 dark:text-zinc-50 text-center mb-12 text-balance">
            {t('landing.features.title')}
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8" role="list">
          {features.map(({ Visual, titleKey, descKey }, index) => (
            <ScrollReveal key={titleKey} delay={index * 120}>
              <div
                role="listitem"
                className="p-6 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <Visual />
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t(titleKey)}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {t(descKey)}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
