"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '../i18n';

const CONSENT_KEY = 'doctalk_analytics_consent';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { t } = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    const syncDialogState = () => {
      setDialogOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')));
    };
    syncDialogState();

    const observer = new MutationObserver(syncDialogState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [visible]);

  if (!visible || dialogOpen) return null;

  const isWorkspaceRoute = Boolean(
    pathname?.startsWith('/d/')
      || pathname?.startsWith('/collections')
      || pathname?.startsWith('/shared/')
      || pathname === '/document-diff',
  );
  const isCollectionWorkspace = Boolean(pathname?.startsWith('/collections'));

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
      className={`fixed z-40 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95
                 animate-[slideUp_0.3s_ease-out] motion-reduce:animate-none
                 ${isWorkspaceRoute
                   ? `${isCollectionWorkspace ? 'top-[calc(env(safe-area-inset-top,0px)+9.5rem)] sm:top-[calc(env(safe-area-inset-top,0px)+4.75rem)]' : 'top-[calc(env(safe-area-inset-top,0px)+4.75rem)]'} left-3 right-3 sm:left-auto sm:right-4 sm:w-[min(26rem,calc(100vw-2rem))]`
                   : 'bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[min(28rem,calc(100vw-2rem))]'}`}
      role="region"
      aria-label={t('consent.message')}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {t('consent.message')}{' '}
          <Link
            href="/privacy"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
          >
            {t('consent.learnMore')}
          </Link>
        </p>
        <div className="flex justify-end gap-2">
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
