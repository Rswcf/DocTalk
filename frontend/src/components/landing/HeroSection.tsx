"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n';
import HeroArtifact from './HeroArtifact';
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
              {' '}—{' '}Document intelligence
            </p>

            {/* Headline */}
            <h1 className="ed-display mb-6">
              {headlineLines.map((line: string, i: number) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
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
              <Link
                href="#auth"
                scroll={false}
                onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'sign_up' })}
                className="ed-link"
              >
                {t('hero.signUpFree')}
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>

            {/* Metrics row */}
            <hr className="ed-rule mb-8" />
            <div className="flex gap-8">
              <div>
                <p className="ed-num">11</p>
                <p className="ed-label mt-1">Languages</p>
              </div>
              <div>
                <p className="ed-num">5</p>
                <p className="ed-label mt-1">File formats</p>
              </div>
              <div>
                <p className="ed-num">01</p>
                <p className="ed-label mt-1">Cited answers</p>
              </div>
            </div>
          </div>

          {/* ── Figure column ── */}
          <div className="md:col-span-5 mt-12 md:mt-0 flex flex-col justify-center">
            <figure className="ed-figure p-4">
              <HeroArtifact />
            </figure>
            <figcaption className="ed-caption mt-3">
              Fig. 01 — The reading workspace
            </figcaption>
          </div>

        </div>
      </div>
    </section>
  );
}
