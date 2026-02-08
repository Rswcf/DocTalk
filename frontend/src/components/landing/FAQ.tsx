"use client";

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale } from '../../i18n';

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
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-12">
          {t('landing.faq.title')}
        </h2>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full flex items-center justify-between py-5 text-left text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <span className="text-base font-medium pr-4">{t(item.q)}</span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-zinc-400 transition-transform duration-200 ${openIndex === idx ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                  openIndex === idx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="pb-5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t(item.a)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
