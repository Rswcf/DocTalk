"use client";

import React from 'react';
import { useLocale } from '../../i18n';

/**
 * Landing feature set: three claims, each with one line.
 *
 * Plan 2026-09-20 §7 Phase 1 ("FeatureGrid becomes three rows of claim +
 * one-line body"); the owner chose the three on 2026-09-21:
 *  - citations           — the product's core claim, and what the hero frame shows
 *  - languages           — serves cross-lingual readers, a measured cohort that
 *                          no marketing page addressed
 *  - layout translation  — the paid differentiator
 * Dropped: formats, modes, free demo, privacy. The hero already sends people to
 * the demo, SecuritySection covers privacy, and /features carries the full list.
 *
 * Removed with them: seven bespoke mini-illustrations (30 rendered text nodes
 * at 7–10px, under the plan's 12px floor), the numbered "01 —" labels on
 * content that is not a sequence, and the "Features" eyebrow, which was still
 * English in four locales.
 */
const features = [
  { titleKey: 'landing.feature.citations.title', descKey: 'landing.feature.citations.desc' },
  { titleKey: 'landing.feature.languages.title', descKey: 'landing.feature.languages.desc' },
  {
    titleKey: 'landing.feature.layoutTranslation.title',
    descKey: 'landing.feature.layoutTranslation.desc',
    titleFallback: 'Translate PDFs without breaking layout',
    descFallback:
      'Plus creates translated PDFs for papers, contracts, manuals, and reports while preserving page structure and visual context.',
  },
] as const;

export default function FeatureGrid() {
  const { t, tOr } = useLocale();

  return (
    <section id="features" className="ed-section">
      <div className="ed-shell">
        <h2 className="ed-h2 max-w-xl">{t('landing.features.title')}</h2>

        <ul className="mt-10 grid grid-cols-1 border-t border-[var(--ed-rule)] md:grid-cols-3">
          {features.map((feature, index) => {
            const title =
              'titleFallback' in feature ? tOr(feature.titleKey, feature.titleFallback) : t(feature.titleKey);
            const desc =
              'descFallback' in feature ? tOr(feature.descKey, feature.descFallback) : t(feature.descKey);
            return (
              <li
                key={feature.titleKey}
                className={[
                  'py-8',
                  // Stacked on phones: a hairline between items. Side by side from md:
                  // a hairline between columns instead.
                  index > 0 ? 'border-t border-[var(--ed-rule)] md:border-t-0 md:border-s md:ps-8' : '',
                  index < features.length - 1 ? 'md:pe-8' : '',
                ].join(' ')}
              >
                <h3 className="ed-h3">{title}</h3>
                <p className="ed-body mt-2">{desc}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
