"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCount(target);
      setStarted(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started) {
          setStarted(true);
          obs.unobserve(e.target);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started, target]);

  useEffect(() => {
    if (!started) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCount(target);
      return;
    }
    const dur = 2000;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const metrics = [
  { target: 10000, suffix: '+', labelKey: 'landing.social.metric1' },
  { target: 11, suffix: '', labelKey: 'landing.social.metric2' },
  { target: 2, suffix: '', labelKey: 'landing.social.metric3' },
  { staticValue: '99.9%', labelKey: 'landing.social.metric4' },
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
                  {'staticValue' in metric ? (
                    metric.staticValue
                  ) : (
                    <AnimatedCounter target={metric.target} suffix={metric.suffix} />
                  )}
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
