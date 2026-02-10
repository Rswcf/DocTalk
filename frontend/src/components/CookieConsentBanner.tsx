"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from '../i18n';

const CONSENT_KEY = 'doctalk_analytics_consent';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
    window.dispatchEvent(new Event('doctalk:consent-changed'));
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 dark:border-zinc-800
                 bg-white dark:bg-zinc-950 px-4 py-3 sm:px-6 sm:py-4
                 animate-[slideUp_0.3s_ease-out]
                 motion-reduce:animate-none"
    >
      <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 flex-1 text-center sm:text-left">
          {t('consent.message')}{' '}
          <Link
            href="/privacy"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
          >
            {t('consent.learnMore')}
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700
                       text-zinc-700 dark:text-zinc-300
                       hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t('consent.decline')}
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 text-sm rounded-lg
                       bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900
                       hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
