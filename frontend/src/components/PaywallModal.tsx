"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useLocale } from "../i18n";
import { billingHref, deriveUpgradePlan } from "../lib/billingLinks";
import { trackEvent } from "../lib/analytics";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string | null;
  /**
   * Current user's billing tier ('free' | 'plus' | 'pro' | undefined for
   * anonymous/demo). Determines whether the CTA targets the Plus or Pro
   * upgrade page when the paywall fires. A Plus user hitting the Pro-mode cap
   * needs to be routed to Pro — not bounced back to the Plus they already
   * have (I18). Mirrors the analytics-side derivation in useChatStream (I27).
   */
  currentPlan?: string;
}

function paywallCopy(reason: string | null | undefined, t: (key: string) => string, tOr: (key: string, fallback: string) => string) {
  if (reason === 'PRO_MODE_LIMIT_REACHED' || reason === 'BALANCED_MODE_LIMIT_REACHED' || reason === 'MODE_NOT_ALLOWED') {
    return {
      title: tOr('paywall.proMode.title', 'Keep using Pro analysis'),
      body: tOr('paywall.proMode.body', 'Free includes a limited number of Pro answers. Plus unlocks unrestricted Pro mode for deeper cited analysis.'),
      primaryLabel: tOr('paywall.proMode.cta', 'Upgrade for Pro mode'),
      reason: 'pro_mode_limit',
    };
  }

  if (reason === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
    return {
      title: tOr('paywall.layoutTranslation.title', 'Keep translating full PDFs'),
      body: tOr('paywall.layoutTranslation.body', 'Free includes 2 layout-preserving PDF translations. Plus unlocks this workflow for active document work.'),
      primaryLabel: tOr('paywall.layoutTranslation.cta', 'Upgrade for PDF translation'),
      reason: 'layout_translation_limit',
    };
  }

  return {
    title: t("credits.insufficientCredits"),
    body: t("credits.purchasePrompt"),
    primaryLabel: t("credits.upgradeToPlus"),
    reason: 'credits',
  };
}

export function PaywallModal({ isOpen, onClose, reason, currentPlan }: PaywallModalProps) {
  const { t, tOr } = useLocale();
  const modalRef = useRef<HTMLDivElement>(null);
  const copy = paywallCopy(reason, t, tOr);
  const targetPlan = deriveUpgradePlan(currentPlan, reason ?? null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
    focusables[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const currentFocusables = modal!.querySelectorAll<HTMLElement>(focusableSelector);
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    modal.addEventListener('keydown', handleKeyDown);
    return () => {
      modal.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in motion-reduce:animate-none overscroll-contain"
      onClick={onClose}
      tabIndex={-1}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl animate-slide-up motion-reduce:animate-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="paywall-title" className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          {copy.title}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          {copy.body}
        </p>
        <ul className="mb-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          {[
            tOr('paywall.benefit.credits', 'More monthly credits for active document work'),
            tOr('paywall.benefit.modes', 'Flash and Pro modes without the free-plan cap'),
            tOr('paywall.benefit.layoutTranslation', 'Layout-preserving PDF translation for complex papers and reports'),
            tOr('paywall.benefit.exports', 'PDF and DOCX exports for cited deliverables'),
          ].map((benefit) => (
            <li key={benefit} className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={billingHref({ plan: targetPlan, source: 'paywall_modal', reason: copy.reason })}
            onClick={() => trackEvent('upgrade_click', { plan: targetPlan, period: 'monthly', source: 'paywall_modal', reason: copy.reason })}
            className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-colors text-center focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {copy.primaryLabel}
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
