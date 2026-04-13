"use client";

import { Shield, Check } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '../i18n';

export function PrivacyBadge() {
  const { t, tOr } = useLocale();

  return (
    <div className="w-full max-w-xl mb-6 flex flex-col items-center gap-2 text-sm">
      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
        <Shield aria-hidden="true" size={16} className="text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium">{t('privacy.badge')}</span>
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
        <li className="flex items-center gap-1.5">
          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t('privacy.encrypted')}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t('privacy.noTraining')}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t('privacy.deleteAnytime')}</span>
        </li>
      </ul>

      <Link
        href="/trust"
        className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
      >
        {tOr('privacy.trustLink', 'Trust Center')} →
      </Link>
    </div>
  );
}
