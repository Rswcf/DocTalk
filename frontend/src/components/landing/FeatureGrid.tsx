"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

/* ---------- Bespoke per-card visuals ---------- */
/* Each visual shows the actual product concept rather than a generic icon.
   All inline SVG / HTML so no extra network requests, no recording needed.
   Decorative — aria-hidden at root. Every visual shares one canvas size so
   the grid reads as a calm, uniform set. */

// One shared canvas for every tile — flat inset panel, 128px tall.
const canvas =
  'relative mb-5 h-32 w-full overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-800';

function VisualCitations() {
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
        {/* Mock document page with a highlighted line */}
        <div className="relative h-24 w-32 rounded-sm border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-1.5 font-mono text-[7px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            report.pdf · p. 4
          </div>
          <div className="space-y-1">
            <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-600" />
            <div className="h-1.5 w-full rounded-sm bg-amber-200 dark:bg-amber-500/45" />
            <div className="h-1 w-4/5 rounded-full bg-zinc-200 dark:bg-zinc-600" />
            <div className="h-1 w-3/4 rounded-full bg-zinc-200 dark:bg-zinc-600" />
          </div>
        </div>
        {/* Page badge + citation chip */}
        <div className="flex flex-col items-start gap-1.5">
          <div className="rounded border border-accent/30 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-accent shadow-sm dark:bg-zinc-800">
            p. 4 · ln 3
          </div>
          <div className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-[9px] text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <span className="mr-1 inline-flex items-center justify-center rounded bg-accent px-1 py-0.5 text-[8px] font-bold leading-none text-accent-foreground">
              1
            </span>
            cite
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualFormats() {
  const chips = ['PDF', 'DOCX', 'PPTX', 'XLSX', 'TXT', 'MD', 'URL'];
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex max-w-[220px] flex-wrap items-center justify-center gap-1.5 px-3">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
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
  // A diverse selection of lang-codes, evoking a globe of supported locales.
  const langs = ['EN', '中文', '日本語', 'ES', 'DE', 'FR', '한국어', 'PT', 'IT', 'العربية', 'हिन्दी'];
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div className="flex max-w-[220px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
          {langs.map((l) => (
            <span key={l} className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
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
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Flash
          </span>
          <span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400">fast</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
            Pro
          </span>
          <span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400">deeper</span>
        </div>
      </div>
    </div>
  );
}

function VisualFreeDemo() {
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        {/* Stacked demo doc cards */}
        <div className="relative">
          <div className="absolute -left-1 -top-1 h-16 w-14 rounded-sm border border-zinc-200 bg-white opacity-60 shadow-sm dark:border-zinc-700 dark:bg-zinc-800" />
          <div className="absolute -left-0.5 -top-0.5 h-16 w-14 rounded-sm border border-zinc-200 bg-white opacity-80 shadow-sm dark:border-zinc-700 dark:bg-zinc-800" />
          <div className="relative h-16 w-14 rounded-sm border border-zinc-200 bg-white px-1.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div className="space-y-1">
              <div className="h-0.5 w-full rounded-full bg-zinc-300 dark:bg-zinc-500" />
              <div className="h-0.5 w-5/6 rounded-full bg-zinc-300 dark:bg-zinc-500" />
              <div className="h-0.5 w-3/4 rounded-full bg-zinc-300 dark:bg-zinc-500" />
            </div>
          </div>
        </div>
        {/* No-signup badge */}
        <div className="flex flex-col items-start gap-1">
          <span className="rounded border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            No signup
          </span>
          <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">3 demos</span>
        </div>
      </div>
    </div>
  );
}

function VisualPrivacy() {
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-accent"
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
          <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            AES-256
          </span>
          <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            No training
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Uniform 3-column grid ---------- */

interface Tile {
  Visual: React.ComponentType;
  titleKey: string;
  descKey: string;
}

const tiles: Tile[] = [
  { Visual: VisualCitations, titleKey: 'landing.feature.citations.title', descKey: 'landing.feature.citations.desc' },
  { Visual: VisualFormats,   titleKey: 'landing.feature.formats.title',   descKey: 'landing.feature.formats.desc' },
  { Visual: VisualLanguages, titleKey: 'landing.feature.languages.title', descKey: 'landing.feature.languages.desc' },
  { Visual: VisualModes,     titleKey: 'landing.feature.modes.title',     descKey: 'landing.feature.modes.desc' },
  { Visual: VisualFreeDemo,  titleKey: 'landing.feature.freeDemo.title',  descKey: 'landing.feature.freeDemo.desc' },
  { Visual: VisualPrivacy,   titleKey: 'landing.feature.privacy.title',   descKey: 'landing.feature.privacy.desc' },
];

export default function FeatureGrid() {
  const { t, tOr } = useLocale();

  return (
    <section id="features" className="bg-zinc-50 py-24 dark:bg-zinc-900/50">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <h2 className="mb-12 text-balance text-center font-serif text-3xl font-medium tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 md:text-4xl">
            {t('landing.features.title')}
          </h2>
        </ScrollReveal>
        {/* Uniform 3-column grid (2 rows of 3 on desktop) — every tile is the
            same size so the section reads as a calm, even set. */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {tiles.map(({ Visual, titleKey, descKey }, index) => (
            <ScrollReveal key={titleKey} delay={Math.min(index * 80, 320)}>
              <div
                role="listitem"
                className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Visual />
                <h3 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {t(titleKey)}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
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
