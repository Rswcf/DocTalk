"use client";

import React from 'react';
import { Shield, Lock, Trash2, Eye } from 'lucide-react';
import { useLocale } from '../../i18n';
import ScrollReveal from './ScrollReveal';

const cards = [
  { icon: Shield, titleKey: 'landing.security.noTraining.title', descKey: 'landing.security.noTraining.desc' },
  { icon: Lock, titleKey: 'landing.security.encrypted.title', descKey: 'landing.security.encrypted.desc' },
  { icon: Trash2, titleKey: 'landing.security.deletion.title', descKey: 'landing.security.deletion.desc' },
  { icon: Eye, titleKey: 'landing.security.private.title', descKey: 'landing.security.private.desc' },
];

export default function SecuritySection() {
  const { t } = useLocale();

  return (
    <section className="bg-zinc-50 dark:bg-zinc-900/50 border-t border-b border-zinc-200 dark:border-zinc-800 py-24">
      <div className="max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <h2 className="font-display text-3xl tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-12 text-balance">
            {t('landing.security.title')}
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {cards.map(({ icon: Icon, titleKey, descKey }, index) => (
            <ScrollReveal key={titleKey} delay={index * 100}>
              <div
                className="p-6 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm"
              >
                <div className="w-12 h-12 rounded-lg bg-accent-light dark:bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <Icon aria-hidden="true" size={20} className="text-accent" />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t(titleKey)}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t(descKey)}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
