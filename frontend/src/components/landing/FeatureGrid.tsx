"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

/* ---------- Bespoke per-feature visuals — editorial neutrals ---------- */
/* All backgrounds → var(--ed-paper-2), borders → var(--ed-rule),
   text → --ed-ink / --ed-ink-3, any accent → var(--ed-signal).
   No dark: variants, no gradients, no zinc-*, no blue-*.
   Decorative — aria-hidden at root. */

// Shared canvas: paper-2 background, rule border, compact 112px tall.
const canvas =
  'relative h-28 w-full overflow-hidden border border-[var(--ed-rule)] bg-[var(--ed-paper-2)]';

function VisualCitations() {
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
        {/* Mock document page with a highlighted line */}
        <div className="relative h-20 w-28 border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1.5">
          <div className="mb-1.5 font-mono text-[7px] uppercase tracking-wider text-[var(--ed-ink-3)]">
            report.pdf · p. 4
          </div>
          <div className="space-y-1">
            <div className="h-1 w-full bg-[var(--ed-rule)]" />
            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-signal)]" />
            <div className="h-1 w-4/5 bg-[var(--ed-rule)]" />
            <div className="h-1 w-3/4 bg-[var(--ed-rule)]" />
          </div>
        </div>
        {/* Page badge + citation chip */}
        <div className="flex flex-col items-start gap-1.5">
          <div className="border border-[var(--ed-signal)]/40 bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--ed-signal)]">
            p. 4 · ln 3
          </div>
          <div className="inline-flex items-center border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-1 font-mono text-[9px] text-[var(--ed-ink-2)]">
            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-signal)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
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
              className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--ed-ink-2)]"
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
  const langs = ['EN', '中文', '日本語', 'ES', 'DE', 'FR', '한국어', 'PT', 'IT', 'العربية', 'हिन्दी'];
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div className="flex max-w-[220px] flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
          {langs.map((l) => (
            <span key={l} className="text-[11px] font-semibold text-[var(--ed-ink-3)]">
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
      <div className="absolute inset-0 flex items-center justify-center gap-5">
        <div className="flex flex-col items-center gap-1.5">
          <span className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-3 py-1 font-mono text-[11px] text-[var(--ed-ink-2)]">
            Flash
          </span>
          <span className="font-mono text-[9px] text-[var(--ed-ink-3)]">fast</span>
        </div>
        <div className="h-8 w-px bg-[var(--ed-rule)]" />
        <div className="flex flex-col items-center gap-1.5">
          <span className="border border-[var(--ed-signal)]/50 bg-[var(--ed-paper)] px-3 py-1 font-mono text-[11px] font-semibold text-[var(--ed-signal)]">
            Pro
          </span>
          <span className="font-mono text-[9px] text-[var(--ed-ink-3)]">deeper</span>
        </div>
      </div>
    </div>
  );
}

function VisualFreeDemo() {
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex items-center justify-center gap-4">
        {/* Stacked demo doc cards */}
        <div className="relative">
          <div className="absolute -left-1 -top-1 h-16 w-14 border border-[var(--ed-rule)] bg-[var(--ed-paper)] opacity-50" />
          <div className="absolute -left-0.5 -top-0.5 h-16 w-14 border border-[var(--ed-rule)] bg-[var(--ed-paper)] opacity-75" />
          <div className="relative h-16 w-14 border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-1.5">
            <div className="space-y-1">
              <div className="h-0.5 w-full bg-[var(--ed-rule)]" />
              <div className="h-0.5 w-5/6 bg-[var(--ed-rule)]" />
              <div className="h-0.5 w-3/4 bg-[var(--ed-rule)]" />
            </div>
          </div>
        </div>
        {/* No-signup badge */}
        <div className="flex flex-col items-start gap-1">
          <span className="border border-[var(--ed-signal)]/40 bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--ed-signal)]">
            No signup
          </span>
          <span className="font-mono text-[10px] text-[var(--ed-ink-3)]">3 demos</span>
        </div>
      </div>
    </div>
  );
}

function VisualPrivacy() {
  return (
    <div aria-hidden="true" className={canvas}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-[var(--ed-signal)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="1" ry="1" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ed-ink-3)]">
            AES-256
          </span>
          <span className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ed-ink-3)]">
            No training
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tiles data ---------- */

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

/* Running numbers for the six entries */
const nums = ['01', '02', '03', '04', '05', '06'];

/* ---------- Editorial feature set ---------- */

export default function FeatureGrid() {
  const { t, tOr } = useLocale();

  return (
    <section id="features" className="ed-section">
      <div className="ed-shell">
        {/* Section header */}
        <ScrollReveal>
          <div className="mb-10">
            <p className="ed-label mb-3">Features</p>
            <h2 className="ed-h2 max-w-xl">
              {t('landing.features.title')}
            </h2>
          </div>
        </ScrollReveal>

        <hr className="ed-rule mb-0" />

        {/* 2-column grid — 3 rows of 2 on desktop, single column on mobile.
            ed-rule hairlines separate rows; vertical rule separates columns. */}
        <div className="grid grid-cols-1 md:grid-cols-2" role="list">
          {tiles.map(({ Visual, titleKey, descKey }, index) => {
            const isLastRow = index >= 4;
            const isRightCol = index % 2 === 1;

            return (
              <React.Fragment key={titleKey}>
                <ScrollReveal delay={Math.min((index % 2) * 80, 160)}>
                  <div
                    role="listitem"
                    className={[
                      'flex flex-col gap-5 py-10 px-0',
                      /* Right column gets a left border on desktop */
                      isRightCol ? 'md:pl-10 md:border-l md:border-[var(--ed-rule)]' : 'md:pr-10',
                      /* Row separator — all but last row */
                      !isLastRow ? 'border-b border-[var(--ed-rule)]' : '',
                    ].join(' ')}
                  >
                    {/* Numbered label */}
                    <p className="ed-label">
                      <span className="ed-label-num">{nums[index]}</span>
                      {' '}—{' '}
                    </p>

                    {/* Text + figure — side by side on wider entry, calm layout */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                      {/* Figure plate */}
                      <div className="ed-figure flex-shrink-0 sm:w-44">
                        <Visual />
                      </div>

                      {/* Text */}
                      <div className="flex flex-col gap-2">
                        <h3 className="ed-h3">{t(titleKey)}</h3>
                        <p className="ed-body">{tOr(descKey, '')}</p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              </React.Fragment>
            );
          })}
        </div>

        <hr className="ed-rule mt-0" />
      </div>
    </section>
  );
}
