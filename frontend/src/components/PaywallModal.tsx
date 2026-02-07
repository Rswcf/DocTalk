"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "../i18n";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const { t } = useLocale();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      overlayRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="paywall-title" className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          {t("credits.insufficientCredits")}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          {t("credits.purchasePrompt")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => (window.location.href = "/billing")}
            className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-colors"
          >
            {t("credits.buyCredits")}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
