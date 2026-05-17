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
      className={`fixed z-40 rounded-2xl border border-[var(--workbench-border)] bg-[var(--workbench-panel-solid)] px-4 py-3 text-[var(--workbench-ink)] shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:shadow-black/35
                 animate-[slideUp_0.3s_ease-out] motion-reduce:animate-none
                 ${isWorkspaceRoute
                   ? `${isCollectionWorkspace ? 'top-[calc(env(safe-area-inset-top,0px)+9.5rem)] sm:top-[calc(env(safe-area-inset-top,0px)+4.75rem)]' : 'top-[calc(env(safe-area-inset-top,0px)+4.75rem)]'} left-3 right-3 sm:left-auto sm:right-4 sm:w-[min(26rem,calc(100vw-2rem))]`
                   : 'bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[min(28rem,calc(100vw-2rem))]'}`}
      role="region"
      aria-label={t('consent.message')}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-6 text-[var(--workbench-muted)]">
          {t('consent.message')}{' '}
          <Link
            href="/privacy"
            className="underline transition-colors hover:text-[var(--workbench-ink)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
          >
            {t('consent.learnMore')}
          </Link>
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleDecline}
            className="rounded-full border border-[var(--workbench-border)] px-4 py-1.5 text-sm text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-[var(--workbench-ink)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:hover:bg-white/10 dark:focus-visible:ring-offset-zinc-950"
          >
            {t('consent.decline')}
          </button>
          <button
            onClick={handleAccept}
            className="dt-stitch-primary rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
