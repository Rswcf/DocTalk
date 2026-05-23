"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import HeroCollage from './HeroCollage';
import { trackEvent } from '../../lib/analytics';

export default function HeroSection() {
  const { t } = useLocale();
  const headlineLines = t('landing.headline').split('\n');

  return (
    <section className="ed-section">
      <div className="ed-shell">
        {/* Asymmetric 12-col grid: text 7 cols, figure 5 cols */}
        <div className="md:grid md:grid-cols-12 md:gap-12">

          {/* ── Text column ── */}
          <div className="md:col-span-7 flex flex-col justify-center">

            {/* Eyebrow label */}
            <p className="ed-label mb-6">
              <span className="ed-label-num">01</span>
              {' '}—{' '}{t('landing.heroEyebrow')}
            </p>

            {/* Headline — heavy grotesque first line, italic-serif second line */}
            <h1 className="ed-display mb-6">
              {headlineLines.map((line: string, i: number) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {i === headlineLines.length - 1 && headlineLines.length > 1
                    ? <em>{line}</em>
                    : line}
                </React.Fragment>
              ))}
            </h1>

            {/* Standfirst */}
            <p className="ed-lede mb-8">
              {t('landing.description')}
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link
                href="/demo"
                onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'demo' })}
                className="ed-cta"
              >
                {t('landing.cta.demo')}
                <ArrowRight aria-hidden="true" size={16} />
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
                <ArrowRight aria-hidden="true" size={14} />
              </a>
            </div>

            {/* Metrics — editorial stat band. The hairline rule is constrained
                to the stat group's width (max-w) so it caps the three figures
                instead of running across the empty right half; an even 3-col
                grid gives 11 / 5 / 01 a consistent rhythm regardless of digit
                count; the rule sits close above so the band reads as one unit. */}
            <div className="mt-2 max-w-[460px]">
              <hr className="ed-rule mb-5" />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="ed-num">11</p>
                  <p className="ed-label mt-1.5">{t('landing.heroStats.languages')}</p>
                </div>
                <div>
                  <p className="ed-num">5</p>
                  <p className="ed-label mt-1.5">{t('landing.heroStats.formats')}</p>
                </div>
                <div>
                  <p className="ed-num">01</p>
                  <p className="ed-label mt-1.5">{t('landing.heroStats.citedAnswers')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Figure column ── */}
          <div className="md:col-span-5 mt-12 md:mt-0 flex flex-col justify-center">
            <HeroCollage />
          </div>

        </div>
      </div>
    </section>
  );
}
