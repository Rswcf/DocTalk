"use client";

import { useState } from 'react';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '../i18n';
import Link from 'next/link';

export function PrivacyBadge() {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLocale();

  return (
    <div className="w-full max-w-xl mb-6">
      {/* Badge Line */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400
                   hover:text-zinc-800 dark:hover:text-zinc-200 transition-all duration-200 w-full"
      >
        <Shield size={16} className="text-green-600" />
        <span>{t('privacy.badge')}</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-zinc-700 dark:text-zinc-300">{t('privacy.noTraining')}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-zinc-700 dark:text-zinc-300">{t('privacy.encrypted')}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-zinc-700 dark:text-zinc-300">{t('privacy.deleteAnytime')}</span>
          </p>
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex gap-4 text-xs">
            <Link href="/privacy" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all duration-200 hover:underline">{t('privacy.policyLink')}</Link>
            <Link href="/terms" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all duration-200 hover:underline">{t('privacy.termsLink')}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
