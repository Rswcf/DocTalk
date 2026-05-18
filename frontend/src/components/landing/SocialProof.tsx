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
  const { t } = useLocale();

  return (
    <ScrollReveal>
      <section className="border-y border-blue-800 bg-blue-700 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-balance text-center font-serif text-3xl font-semibold tracking-tight text-white">
            {t('landing.social.title')}
          </h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.labelKey}
                className="flex flex-col items-center py-6 text-center"
              >
                <div className="mb-2 text-4xl font-bold tracking-tight tabular-nums text-white md:text-5xl">
                  {'staticValue' in metric ? (
                    metric.staticValue
                  ) : (
                    <AnimatedCounter target={metric.target} suffix={metric.suffix} />
                  )}
                </div>
                <div className="text-xs font-medium uppercase tracking-widest text-blue-200">
                  {t(metric.labelKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ScrollReveal>
  );
}
