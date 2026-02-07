"use client";

import React from 'react';
import { Upload, MessageSquare, BookOpen } from 'lucide-react';
import { useLocale } from '../../i18n';

const steps = [
  { num: 1, icon: Upload, titleKey: 'landing.howItWorks.step1.title', descKey: 'landing.howItWorks.step1.desc' },
  { num: 2, icon: MessageSquare, titleKey: 'landing.howItWorks.step2.title', descKey: 'landing.howItWorks.step2.desc' },
  { num: 3, icon: BookOpen, titleKey: 'landing.howItWorks.step3.title', descKey: 'landing.howItWorks.step3.desc' },
];

export default function HowItWorks() {
  const { t } = useLocale();

  return (
    <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-24">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-16">
        {t('landing.howItWorks.title')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 relative">
        {/* Connecting dashed line (desktop only) */}
        <div className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] border-t border-dashed border-zinc-300 dark:border-zinc-700" />

        {steps.map(({ num, icon: Icon, titleKey, descKey }) => (
          <div key={num} className="flex flex-col items-center text-center relative z-10">
            {/* Number badge */}
            <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-bold flex items-center justify-center mb-4">
              {num}
            </div>
            {/* Icon */}
            <div className="w-14 h-14 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mb-4">
              <Icon size={24} className="text-zinc-600 dark:text-zinc-400" />
            </div>
            {/* Text */}
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t(titleKey)}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xs">
              {t(descKey)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
