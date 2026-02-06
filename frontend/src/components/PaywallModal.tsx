"use client";

import { useLocale } from "../i18n";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const { t } = useLocale();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          {t("credits.insufficientCredits")}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          {t("credits.purchasePrompt")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => (window.location.href = "/billing")}
            className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-200"
          >
            {t("credits.buyCredits")}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
