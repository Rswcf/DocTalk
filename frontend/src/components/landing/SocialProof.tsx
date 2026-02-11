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
  { target: 3, suffix: '', labelKey: 'landing.social.metric3' },
  { staticValue: '99.9%', labelKey: 'landing.social.metric4' },
] as const;

export default function SocialProof() {
  const { t } = useLocale();

  return (
    <ScrollReveal>
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-16">
          <h2 className="font-display font-medium text-3xl tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-12 text-balance">
            {t('landing.social.title')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((metric) => (
              <div
                key={metric.labelKey}
                className="flex flex-col items-center text-center py-6"
              >
                <div className="text-4xl md:text-5xl font-display font-semibold text-zinc-900 dark:text-zinc-50 mb-2 tabular-nums">
                  {'staticValue' in metric ? (
                    metric.staticValue
                  ) : (
                    <AnimatedCounter target={metric.target} suffix={metric.suffix} />
                  )}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
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
