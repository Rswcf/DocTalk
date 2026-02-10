"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { X } from 'lucide-react';
import { useLocale } from '../i18n';

export function AuthModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();
  const modalRef = useRef<HTMLDivElement>(null);

  const isOpen = searchParams.get('auth') === '1';

  const handleClose = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    router.replace(url.pathname + url.search, { scroll: false });
  };

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

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

  const handleGoogleLogin = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    signIn('google', { callbackUrl: url.toString() });
  };

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
        className="bg-white dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md mx-4 shadow-xl border border-zinc-200 dark:border-zinc-800 animate-slide-up motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="auth-modal-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {t('auth.loginToContinue')}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400"
            aria-label="Close"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          {t('auth.loginBenefits')}
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3
                     hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-zinc-700 dark:text-zinc-200">{t('auth.continueWithGoogle')}</span>
        </button>

        <p className="mt-4 text-xs text-zinc-400 text-center">
          {t('auth.termsNotice').split('Terms of Service')[0]}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">Terms of Service</a>
          {' and '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">Privacy Policy</a>.
        </p>

        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center space-y-2">
          <p className="text-xs text-zinc-400">
            {t('auth.privacyNote')}
          </p>
          <p className="text-xs text-zinc-400">
            {t('auth.aiDisclosure')}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
            {t('auth.freeCredits')}
          </p>
        </div>
      </div>
    </div>
  );
}
