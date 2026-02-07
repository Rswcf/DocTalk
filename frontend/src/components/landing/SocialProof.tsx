"use client";

import React from 'react';
import { FileText, Globe, Cpu, Server } from 'lucide-react';
import { useLocale } from '../../i18n';

const metrics = [
  { icon: FileText, value: '10,000+', labelKey: 'landing.social.metric1' },
  { icon: Globe, value: '9', labelKey: 'landing.social.metric2' },
  { icon: Cpu, value: '9', labelKey: 'landing.social.metric3' },
  { icon: Server, value: '99.9%', labelKey: 'landing.social.metric4' },
];

export default function SocialProof() {
  const { t } = useLocale();

  return (
    <section className="max-w-5xl mx-auto px-6 py-24">
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-16">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-12">
          {t('landing.social.title')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {metrics.map(({ icon: Icon, value, labelKey }) => (
            <div
              key={labelKey}
              className="flex flex-col items-center text-center p-6 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mb-3">
                <Icon size={18} className="text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
                {value}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {t(labelKey)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
