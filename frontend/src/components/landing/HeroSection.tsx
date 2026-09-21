"use client";

import React from 'react';
import Link from 'next/link';
import { useLocale } from '../../i18n';
import ProductFrame from './ProductFrame';
import { trackEvent } from '../../lib/analytics';

/**
 * Landing hero, in the Apple order (plan 2026-09-20 §5.2): one claim, one
 * sentence, one filled action, then the product. The landing is the one page
 * where the claim and frame sit centred.
 *
 * Deliberately absent, and why:
 *  - No eyebrow. It read "01 — Document intelligence": a numbered label on
 *    content that is not a sequence.
 *  - No stat band ("11 / 6 / 01"). "01 cited answers" read as a broken counter.
 *    The `landing.heroStats.*` keys are left in the locale files, unused.
 *  - No italic split. The last headline line used to be wrapped in <em>; the
 *    type system now sets display type upright, so the wrapper only made the
 *    markup misleading.
 *  - No trailing arrows on the actions.
 *
 * `landing.headline` and `landing.description` are not edited: they are also
 * the <title> and <meta description> keys for app/[locale]/page.tsx.
 */
export default function HeroSection() {
  const { t } = useLocale();
  const headlineLines = t('landing.headline').split('\n');

  return (
    <section className="ed-section">
      <div className="ed-shell">
        <div className="mx-auto max-w-[760px] text-center">
          <h1 className="ed-display">
            {headlineLines.map((line: string, i: number) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h1>

          <p className="ed-lede mx-auto mt-6 max-w-[600px]">
            {t('landing.description')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link
              href="/demo"
              onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'demo' })}
              className="ed-cta"
            >
              {t('landing.cta.demo')}
            </Link>
            {/* Plain <a> (not next/link): a native hash anchor fires the
                `hashchange` event AuthModal listens for, so the modal opens.
                next/link updates the hash via history API without firing it. */}
            <a
              href="#auth"
              onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'sign_up' })}
              className="ed-link"
            >
              {t('hero.signUpFree')}
            </a>
          </div>
        </div>

        <ProductFrame />
      </div>
    </section>
  );
}
