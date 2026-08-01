"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { useLocale } from '../i18n';
import { AuthFormContent } from './AuthFormContent';
import { AUTH_MODAL_HASH, clearAuthCallbackOverride, getUrlWithoutAuthHash, isAuthModalHash, peekAuthCallbackOverride } from '../lib/auth-modal';
import { trackEvent } from '../lib/analytics';

export function AuthModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const syncFromHash = () => setIsOpen(isAuthModalHash(window.location.hash));
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (searchParams.get('auth') !== '1') return;
    const currentSearch = new URLSearchParams(searchParams.toString());
    currentSearch.delete('auth');
    const nextUrl = `${pathname}${currentSearch.size ? `?${currentSearch.toString()}` : ''}${AUTH_MODAL_HASH}`;
    router.replace(nextUrl, { scroll: false });
    setIsOpen(true);
  }, [pathname, router, searchParams]);

  const handleClose = () => {
    const url = new URL(window.location.href);
    url.hash = '';
    router.replace(getUrlWithoutAuthHash(url), { scroll: false });
    setIsOpen(false);
  };

  // Clear the override on every open→closed transition, not just `handleClose`
  // — `isOpen` can also flip to false via the `hashchange`/`syncFromHash` path
  // (e.g. a mobile back-gesture navigating off `#auth`), which bypasses
  // `handleClose` entirely. Without this, a stale override could reapply on a
  // later hash-only reopen. `wasOpenRef` skips the initial (never-opened)
  // mount so a legitimate override set just before the modal opens isn't
  // wiped before `isOpen` catches up.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      clearAuthCallbackOverride();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    trackEvent('auth_modal_opened', { source: 'auth_modal' });
    const previouslyFocused = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
    const first = focusables[0];

    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const currentFocusables = modal!.querySelectorAll<HTMLElement>(focusableSelector);
      const currentFirst = currentFocusables[0];
      const currentLast = currentFocusables[currentFocusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === currentFirst) {
          e.preventDefault();
          currentLast?.focus();
        }
      } else {
        if (document.activeElement === currentLast) {
          e.preventDefault();
          currentFirst?.focus();
        }
      }
    }

    modal.addEventListener('keydown', handleKeyDown);
    return () => {
      modal.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const callbackUrl = (() => {
    const override = peekAuthCallbackOverride();
    if (override) {
      // Resolve against the current origin instead of blindly concatenating
      // — an absolute or protocol-relative override (`https://evil.com/x`,
      // `//evil.com/x`) would resolve to a different origin; reject it and
      // fall back to the current page rather than trust an arbitrary string
      // passed to `openAuthModal({ callbackUrl })`.
      try {
        const resolved = new URL(override, window.location.origin);
        if (resolved.origin === window.location.origin) {
          return resolved.toString();
        }
      } catch {
        // malformed override — fall through to the current-page default
      }
    }
    const currentSearch = searchParams.toString();
    return `${window.location.origin}${pathname}${currentSearch ? `?${currentSearch}` : ''}`;
  })();

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in motion-reduce:animate-none"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl p-8 w-full max-w-md mx-4 shadow-xl border border-zinc-200 dark:border-zinc-800 animate-slide-up motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="auth-modal-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {t('auth.loginToContinue')}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400"
            aria-label={t('common.close')}
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          {t('auth.loginBenefits')}
        </p>

        <AuthFormContent callbackUrl={callbackUrl} surface="modal" />
      </div>
    </div>
  );
}
