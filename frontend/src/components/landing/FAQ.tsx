"use client";

import React, { useState } from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

const FAQ_ITEMS = [
  { q: 'landing.faq.q1', a: 'landing.faq.a1' },
  { q: 'landing.faq.q2', a: 'landing.faq.a2' },
  { q: 'landing.faq.q3', a: 'landing.faq.a3' },
  { q: 'landing.faq.q4', a: 'landing.faq.a4' },
  { q: 'landing.faq.q5', a: 'landing.faq.a5' },
  { q: 'landing.faq.q6', a: 'landing.faq.a6' },
] as const;

export default function FAQ() {
  const { t } = useLocale();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="ed-section">
      <div className="ed-shell">
        <ScrollReveal>
          <div className="max-w-[760px]">
            <p className="ed-label mb-3">FAQ</p>
            <h2 className="ed-h2 mb-10">{t('landing.faq.title')}</h2>
          </div>
          <hr className="ed-rule" />
        </ScrollReveal>

        <div className="max-w-[760px]">
          {FAQ_ITEMS.map((item, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const isOpen = openIndex === idx;
            return (
              <ScrollReveal key={idx} delay={idx * 60}>
                <div>
                  <button
                    type="button"
                    id={`faq-btn-${idx}`}
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${idx}`}
                    className="w-full flex items-start justify-between py-6 text-left focus-visible:outline-none"
                    style={{ outline: 'none' }}
                  >
                    <span className="flex items-start gap-4 pr-6">
                      <span
                        className="ed-label ed-label-num shrink-0 mt-1"
                        aria-hidden="true"
                      >
                        {num}
                      </span>
                      <span className="ed-h3" style={{ color: 'var(--ed-ink)' }}>
                        {t(item.q)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="ed-label shrink-0 mt-1 w-4 text-center"
                      style={{ color: 'var(--ed-ink-3)', fontSize: '16px', letterSpacing: 0 }}
                    >
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  <div
                    id={`faq-panel-${idx}`}
                    role="region"
                    aria-labelledby={`faq-btn-${idx}`}
                    className={`overflow-hidden transition-[max-height,opacity] duration-300 motion-reduce:transition-none ${
                      isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="ed-body pb-6 pl-8">{t(item.a)}</p>
                  </div>

                  <hr className="ed-rule" />
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
