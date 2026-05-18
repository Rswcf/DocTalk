"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

const steps = [
  { num: '01', titleKey: 'landing.howItWorks.step1.title', descKey: 'landing.howItWorks.step1.desc' },
  { num: '02', titleKey: 'landing.howItWorks.step2.title', descKey: 'landing.howItWorks.step2.desc' },
  { num: '03', titleKey: 'landing.howItWorks.step3.title', descKey: 'landing.howItWorks.step3.desc' },
];

export default function HowItWorks() {
  const { t, tOr } = useLocale();

  return (
    <ScrollReveal>
      <section id="how-it-works" className="ed-section">
        <div className="ed-shell">
          {/* Section header */}
          <div className="mb-12">
            <p className="ed-label mb-3">{tOr('landing.howItWorks.eyebrow', 'How it works')}</p>
            <h2 className="ed-h2">{t('landing.howItWorks.title')}</h2>
          </div>

          <hr className="ed-rule mb-0" />

          {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-3">
            {steps.map(({ num, titleKey, descKey }, idx) => (
              <React.Fragment key={num}>
                <div
                  className={
                    'py-10 pr-8' +
                    (idx > 0 ? ' md:pl-8 md:border-l border-[var(--ed-rule)]' : '')
                  }
                >
                  <div className="ed-num mb-4">{num}</div>
                  <h3 className="ed-h3 mb-3">{t(titleKey)}</h3>
                  <p className="ed-body">{t(descKey)}</p>
                </div>
              </React.Fragment>
            ))}
          </div>

          <hr className="ed-rule mt-0" />
        </div>
      </section>
    </ScrollReveal>
  );
}
