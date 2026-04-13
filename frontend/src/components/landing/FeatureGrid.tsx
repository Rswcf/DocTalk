"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

/* ---------- Bespoke per-card visuals ---------- */
/* Each visual shows the actual product concept rather than a generic icon.
   All inline SVG / HTML so no extra network requests, no recording needed,
   distinct enough to read at a glance even at thumbnail size.
   Decorative — aria-hidden at root. */

// Shared canvas for smaller (1-column) tiles — 96px tall.
const bgSmall =
  'relative h-24 w-full overflow-hidden rounded-lg bg-gradient-to-br from-indigo-50 to-zinc-50 dark:from-indigo-950/60 dark:to-zinc-800/60 mb-5';

// Larger canvas for the hero (Citations) tile — lives inside a 2-row span.
const bgHero =
  'relative h-48 md:h-56 w-full overflow-hidden rounded-lg bg-gradient-to-br from-indigo-50 to-zinc-50 dark:from-indigo-950/60 dark:to-zinc-800/60 mb-5';

function VisualCitationsHero() {
  return (
    <div aria-hidden="true" className={bgHero}>
      <div className="absolute inset-0 flex items-center justify-center px-4 gap-3">
        {/* Mock document page — larger, more body text lines */}
        <div className="relative w-40 sm:w-48 h-36 rounded-sm bg-white dark:bg-zinc-800 shadow-md border border-zinc-200 dark:border-zinc-700 px-3 py-3">
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            alphabet-q4-2023.pdf · p. 4
          </div>
          <div className="space-y-1.5">
            <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <div className="h-1 w-5/6 rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <div className="h-2 w-full rounded-sm bg-amber-200 dark:bg-amber-500/45" />
            <div className="h-1 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <div className="h-1 w-3/4 rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <div className="h-1 w-5/6 rounded-full bg-zinc-200 dark:bg-zinc-500" />
          </div>
        </div>
        {/* Page badge + chat bubble citation pointing to highlight */}
        <div className="flex flex-col items-start gap-3">
          <div className="text-[10px] font-semibold text-accent bg-white dark:bg-zinc-800 border border-accent/30 px-2 py-0.5 rounded shadow-sm">
            p. 4 · line 3
          </div>
          <div className="rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm px-2 py-1.5 text-[10px] text-zinc-700 dark:text-zinc-200">
            <span className="inline-flex items-center justify-center text-[9px] font-bold leading-none px-1.5 py-0.5 rounded bg-accent text-accent-foreground mr-1">
              1
            </span>
            cite this
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualFormats() {
  const chips = ['PDF', 'DOCX', 'PPTX', 'XLSX', 'TXT', 'MD', 'URL'];
  return (
    <div aria-hidden="true" className={bgSmall}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 max-w-[200px]">
          {chips.map((c) => (
            <span
              key={c}
              className="text-[10px] font-semibold font-mono px-2 py-1 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-sm"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function VisualLanguages() {
  // Show a diverse selection of lang-codes in mono, evoking a globe
  const langs = ['EN', '中文', '日本語', 'ES', 'DE', 'FR', '한국어', 'PT', 'IT', 'العربية', 'हिन्दी'];
  return (
    <div aria-hidden="true" className={bgSmall}>
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 max-w-[200px]">
          {langs.map((l) => (
            <span
              key={l}
              className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function VisualModes() {
  return (
    <div aria-hidden="true" className={bgSmall}>
      <div className="absolute inset-0 flex items-center justify-center gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
            Quick
          </span>
          <span className="text-[8px] text-zinc-500 dark:text-zinc-400 font-mono">~2s</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 border border-accent/40 text-[10px] font-semibold text-accent">
            Balanced
          </span>
          <span className="text-[8px] text-zinc-500 dark:text-zinc-400 font-mono">~5s</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100 border border-zinc-900 dark:border-zinc-100 text-[10px] font-semibold text-white dark:text-zinc-900">
            Thorough
          </span>
          <span className="text-[8px] text-zinc-500 dark:text-zinc-400 font-mono">~15s</span>
        </div>
      </div>
    </div>
  );
}

function VisualFreeDemo() {
  return (
    <div aria-hidden="true" className={bgSmall}>
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        {/* Stacked demo doc cards */}
        <div className="relative">
          <div className="absolute -top-1 -left-1 w-14 h-16 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm opacity-60" />
          <div className="absolute -top-0.5 -left-0.5 w-14 h-16 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm opacity-80" />
          <div className="relative w-14 h-16 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm px-1.5 py-1.5">
            <div className="space-y-1">
              <div className="h-0.5 w-full rounded-full bg-zinc-300 dark:bg-zinc-500" />
              <div className="h-0.5 w-5/6 rounded-full bg-zinc-300 dark:bg-zinc-500" />
              <div className="h-0.5 w-3/4 rounded-full bg-zinc-300 dark:bg-zinc-500" />
            </div>
          </div>
        </div>
        {/* No-signup badge */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            No signup
          </span>
          <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400">3 demos</span>
        </div>
      </div>
    </div>
  );
}

function VisualPrivacy() {
  return (
    <div aria-hidden="true" className={bgSmall}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            AES-256
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            No training
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bento layout ---------- */

interface Tile {
  Visual: React.ComponentType;
  titleKey: string;
  descKey: string;
  /** Tailwind col-span at lg breakpoint (1-6). */
  lgSpan: 2 | 3 | 4 | 6;
  /** true = hero tile, taller canvas. */
  hero?: boolean;
}

const tiles: Tile[] = [
  { Visual: VisualCitationsHero, titleKey: 'landing.feature.citations.title', descKey: 'landing.feature.citations.desc', lgSpan: 6, hero: true },
  { Visual: VisualFormats,       titleKey: 'landing.feature.formats.title',   descKey: 'landing.feature.formats.desc',   lgSpan: 3 },
  { Visual: VisualLanguages,     titleKey: 'landing.feature.languages.title', descKey: 'landing.feature.languages.desc', lgSpan: 3 },
  { Visual: VisualModes,         titleKey: 'landing.feature.modes.title',     descKey: 'landing.feature.modes.desc',     lgSpan: 4 },
  { Visual: VisualFreeDemo,      titleKey: 'landing.feature.freeDemo.title',  descKey: 'landing.feature.freeDemo.desc',  lgSpan: 4 },
  { Visual: VisualPrivacy,       titleKey: 'landing.feature.privacy.title',   descKey: 'landing.feature.privacy.desc',   lgSpan: 4 },
];

// Map span to static Tailwind classes (Tailwind JIT needs the full class
// to appear in source; we can't build it dynamically with `lg:col-span-${n}`).
const spanClass: Record<Tile['lgSpan'], string> = {
  2: 'md:col-span-2 lg:col-span-2',
  3: 'md:col-span-3 lg:col-span-3',
  4: 'md:col-span-3 lg:col-span-4',
  6: 'md:col-span-6 lg:col-span-6',
};

export default function FeatureGrid() {
  const { t, tOr } = useLocale();

  return (
    <section id="features" className="bg-zinc-50 dark:bg-zinc-900/50 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <ScrollReveal>
          <h2 className="font-medium tracking-[-0.03em] text-3xl md:text-4xl text-zinc-900 dark:text-zinc-50 text-center mb-12 text-balance">
            {t('landing.features.title')}
          </h2>
        </ScrollReveal>
        {/* 6-col grid on md+; natural stack on mobile. Hero citations
            tile spans full width and gets a taller visual canvas. */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6" role="list">
          {tiles.map(({ Visual, titleKey, descKey, lgSpan, hero }, index) => (
            <ScrollReveal key={titleKey} delay={Math.min(index * 80, 320)}>
              <div
                role="listitem"
                className={`${spanClass[lgSpan]} p-6 h-full rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200 motion-reduce:transform-none motion-reduce:transition-none`}
              >
                <Visual />
                <h3 className={`${hero ? 'text-lg' : 'text-base'} font-semibold text-zinc-900 dark:text-zinc-100 mb-2`}>
                  {t(titleKey)}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {/* tOr so new feature keys fall back to English on locales
                      that haven't shipped translations yet. */}
                  {tOr(descKey, '')}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
