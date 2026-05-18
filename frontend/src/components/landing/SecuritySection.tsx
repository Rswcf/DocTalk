"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

const cards = [
  { titleKey: 'landing.security.noTraining.title', descKey: 'landing.security.noTraining.desc' },
  { titleKey: 'landing.security.encrypted.title', descKey: 'landing.security.encrypted.desc' },
  { titleKey: 'landing.security.deletion.title', descKey: 'landing.security.deletion.desc' },
  { titleKey: 'landing.security.private.title', descKey: 'landing.security.private.desc' },
] as const;

export default function SecuritySection() {
  const { t } = useLocale();

  return (
    <section className="ed-section" style={{ borderTop: '1px solid var(--ed-rule)', borderBottom: '1px solid var(--ed-rule)', background: 'var(--ed-paper-2)' }}>
      <div className="ed-shell">
        <ScrollReveal>
          <div className="mb-10">
            <p className="ed-label mb-3">Privacy &amp; Security</p>
            <h2 className="ed-h2 max-w-xl">{t('landing.security.title')}</h2>
          </div>
          <hr className="ed-rule" />
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {cards.map(({ titleKey, descKey }, index) => {
            const num = String(index + 1).padStart(2, '0');
            const isRight = index % 2 === 1;
            const isLastRow = index >= cards.length - 2;
            return (
              <ScrollReveal key={titleKey} delay={index * 80}>
                <div
                  className={[
                    'py-10',
                    'pr-8',
                    isRight ? 'md:pl-10 md:border-l' : '',
                    !isLastRow ? 'border-b' : '',
                  ].join(' ')}
                  style={{
                    borderColor: 'var(--ed-rule)',
                  }}
                >
                  <p className="ed-label mb-4">
                    <span className="ed-label-num">{num}</span>
                    {' '}— Privacy
                  </p>
                  <h3 className="ed-h3 mb-3">{t(titleKey)}</h3>
                  <p className="ed-body">{t(descKey)}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
