"use client";

import Link from "next/link";
import { useLocale } from "../../../i18n";
import DocTalkLogo from "../../../components/DocTalkLogo";

export default function VerifyRequestPage() {
  const { t } = useLocale();

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-zinc-950">
      <div className="max-w-sm w-full">
        {/* Logo / Wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <DocTalkLogo size={32} />
          <span className="font-logo font-semibold text-2xl text-zinc-900 dark:text-zinc-50">DocTalk</span>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm bg-white dark:bg-zinc-900 text-center">
          {/* Mail icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
            {t("auth.checkEmail")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {t("auth.checkEmailSubtitle")}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
            {t("auth.checkSpamHint")}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-6">
            {t("auth.linkExpires")}
          </p>

          <Link
            href="/auth"
            className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 underline underline-offset-2 transition-colors"
          >
            {t("auth.backToSignIn")}
          </Link>
        </div>
      </div>
    </main>
  );
}
