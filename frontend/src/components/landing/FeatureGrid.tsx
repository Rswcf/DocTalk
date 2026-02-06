"use client";

import React from 'react';
import { Zap, BookOpen, Shield } from 'lucide-react';
import { useLocale } from '../../i18n';

const features = [
  { icon: Zap, titleKey: 'landing.feature.answers.title', descKey: 'landing.feature.answers.desc' },
  { icon: BookOpen, titleKey: 'landing.feature.citations.title', descKey: 'landing.feature.citations.desc' },
  { icon: Shield, titleKey: 'landing.feature.privacy.title', descKey: 'landing.feature.privacy.desc' },
];

export default function FeatureGrid() {
  const { t } = useLocale();

  return (
    <section id="features" className="max-w-5xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 text-center mb-12">
        {t('landing.features.title')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map(({ icon: Icon, titleKey, descKey }) => (
          <div
            key={titleKey}
            className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Icon size={20} className="text-zinc-600 dark:text-zinc-400" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t(titleKey)}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(descKey)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
