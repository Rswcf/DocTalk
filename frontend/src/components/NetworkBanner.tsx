"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '../i18n';
import { useNetworkStatus } from '../lib/useNetworkStatus';

export default function NetworkBanner() {
  const { t } = useLocale();
  const isOnline = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      className="w-full border-b border-amber-200 dark:border-amber-700/50 bg-amber-100 dark:bg-amber-500/10 text-zinc-800 dark:text-zinc-200 animate-fade-in motion-reduce:animate-none"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl px-4 py-2 text-sm flex items-center justify-between gap-3">
        <p>{t('network.offline')}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex items-center justify-center rounded p-1 text-zinc-600 dark:text-zinc-300 hover:bg-amber-200/80 dark:hover:bg-amber-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
          aria-label={t('common.cancel')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
