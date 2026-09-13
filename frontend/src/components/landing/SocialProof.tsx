"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

const metrics = [
  { value: '6', labelKey: 'landing.social.metric1' },
  { value: '11', labelKey: 'landing.social.metric2' },
  { value: '2', labelKey: 'landing.social.metric3' },
  { value: 'URL', labelKey: 'landing.social.metric4' },
] as const;

export default function SocialProof() {
  const { t, tOr } = useLocale();

  return (
    <ScrollReveal>
      <section className="ed-section">
        <div className="ed-shell">
          <hr className="ed-rule mb-12" />

          {/* Section header */}
          <div className="mb-12">
            <p className="ed-label mb-3">{tOr('landing.social.eyebrow', 'By the numbers')}</p>
            <h2 className="ed-h2">{t('landing.social.title')}</h2>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4">
            {metrics.map((metric, idx) => (
              <div
                key={metric.labelKey}
                className={
                  'py-8 pr-6' +
                  (idx > 0 ? ' md:pl-6 md:border-l md:border-[var(--ed-rule)]' : '')
                }
              >
                <div className="ed-num mb-2">
                  {metric.value}
                </div>
                <p className="ed-label">{t(metric.labelKey)}</p>
              </div>
            ))}
          </div>

          <hr className="ed-rule mt-12" />
        </div>
      </section>
    </ScrollReveal>
  );
}
