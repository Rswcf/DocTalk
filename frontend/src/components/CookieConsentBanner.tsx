"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '../i18n';

const CONSENT_KEY = 'doctalk_analytics_consent';

type Surface = 'app' | 'editorial' | 'night';

// Scoped to #page-content so the banner's own .dt-editorial wrapper can never
// make it detect itself. 'night' is the landing page, which is dark in both OS
// themes (.dt-editorial.dt-night); the banner mirrors the class, because it
// renders outside that root and would otherwise stay paper in a light OS.
function detectSurface(): Surface {
  const root = document.querySelector('#page-content .dt-editorial');
  if (!root) return 'app';
  return root.classList.contains('dt-night') ? 'night' : 'editorial';
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Which visual system is on the page underneath. The banner is mounted once in
  // app/layout.tsx as a SIBLING of #page-content, so no page can pass it a
  // `surface` prop the way DocumentDiffPanel receives one — it has to look.
  const [surface, setSurface] = useState<Surface>('app');
  const { t } = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Decide the surface in the same batch that reveals the banner. If it were
      // left to the observer effect below, which runs after paint, the first
      // visible frame on a marketing page would be the app-styled banner, and
      // the swap to the editorial tree would restart its slide-in.
      setSurface(detectSurface());
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    const syncDialogState = () => {
      setDialogOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')));
      setSurface(detectSurface());
    };
    syncDialogState();

    // Dialogs across the app mount/unmount via conditional rendering (no shared
    // portal root), so we still need a body-subtree observer to notice them.
    // But during chat-token streaming the message bubble fires hundreds of
    // childList/characterData mutations per second, and the previous direct
    // callback ran the dialog query for every single one. Coalesce all bursts
    // into one query per animation frame instead. Behavior is unchanged; we
    // just bound the cost at ~60Hz.
    let frame: number | null = null;
    const scheduleSync = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        syncDialogState();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
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

  if (surface !== 'app') {
    // Marketing surface (plan 2026-09-20 §5.3/§5.4). The inner .dt-editorial
    // wrapper gives the banner the paper tokens, including the warm dark set,
    // without the outer element inheriting .dt-editorial's position: relative.
    //   - Opaque raised surface, no backdrop blur: the banner sits over busy
    //     content (the pricing cards) and its own text must stay legible.
    //   - Ink, not terracotta. The page already has its one filled terracotta
    //     action above the fold; a consent control must not compete with it.
    //   - One compact row on phones. The two-row card sat exactly on top of the
    //     first price once /pricing moved its plans into the first screen.
    //   - Buttons meet the HIG 44pt minimum hit target.
    return (
      <div
        className="fixed z-40 bottom-2 left-2 right-2 sm:left-auto sm:bottom-4 sm:right-4 sm:w-[min(26rem,calc(100vw-2rem))] overflow-hidden animate-[slideUp_0.3s_ease-out] motion-reduce:animate-none"
        style={{ borderRadius: 'var(--ed-r-3, 16px)', boxShadow: '0 12px 32px -12px rgba(20, 18, 14, 0.28)' }}
        role="region"
        aria-label={t('consent.message')}
      >
        <div
          className={`dt-editorial${surface === 'night' ? ' dt-night' : ''} px-3 py-2.5 sm:px-4 sm:py-3`}
          style={{
            background: 'var(--ed-surface)',
            border: '1px solid var(--ed-rule)',
            borderRadius: 'inherit',
          }}
        >
          <div className="flex items-center gap-3 sm:flex-col sm:items-stretch">
            <p
              className="flex-1 text-[13px] leading-[1.4] sm:text-sm sm:leading-6"
              style={{ color: 'var(--ed-ink-2)' }}
            >
              {t('consent.message')}{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:rounded-sm"
                style={{ color: 'var(--ed-ink)' }}
              >
                {t('consent.learnMore')}
              </Link>
            </p>
            <div className="flex shrink-0 gap-2 sm:justify-end">
              <button
                onClick={handleDecline}
                className="min-h-[44px] rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-4 sm:text-sm"
                style={{ color: 'var(--ed-ink)', border: '1px solid var(--ed-control-border)', background: 'transparent' }}
              >
                {t('consent.decline')}
              </button>
              <button
                onClick={handleAccept}
                className="min-h-[44px] rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-4 sm:text-sm"
                style={{ color: 'var(--ed-paper)', background: 'var(--ed-ink)', border: '1px solid var(--ed-ink)' }}
              >
                {t('consent.accept')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
