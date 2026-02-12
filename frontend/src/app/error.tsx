"use client";

import { useLocale } from "../i18n";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="min-h-screen bg-[var(--page-background)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("error.title")}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 break-words">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          {t("error.tryAgain")}
        </button>
      </div>
    </div>
  );
}
