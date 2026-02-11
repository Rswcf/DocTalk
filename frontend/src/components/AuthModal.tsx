"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useLocale } from '../i18n';
import { AuthFormContent } from './AuthFormContent';

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
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    return url.toString();
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

        <AuthFormContent callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
