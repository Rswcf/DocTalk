"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '../../i18n';

export default function FinalCTA() {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <section className="py-20 px-6 bg-zinc-50 dark:bg-zinc-900/50">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
          {t('landing.finalCta.title')}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          {t('landing.finalCta.subtitle')}
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/demo"
            className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-colors"
          >
            {t('landing.finalCta.demo')}
          </Link>
          <button
            type="button"
            onClick={() => router.push('?auth=1', { scroll: false })}
            className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('landing.finalCta.signUp')}
          </button>
        </div>
      </div>
    </section>
  );
}
