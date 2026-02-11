"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "../../../i18n";
import DocTalkLogo from "../../../components/DocTalkLogo";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const error = searchParams.get("error") || "";

  const getErrorMessage = () => {
    switch (error) {
      case "Verification":
        return t("auth.errorVerification");
      case "AccessDenied":
        return t("auth.errorAccessDenied");
      case "OAuthAccountNotLinked":
        return t("auth.errorAccountNotLinked");
      default:
        return t("auth.errorDefault");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-zinc-950">
      <div className="max-w-sm w-full">
        {/* Logo / Wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <DocTalkLogo size={32} />
          <span className="font-logo font-semibold text-2xl text-zinc-900 dark:text-zinc-50">DocTalk</span>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm bg-white dark:bg-zinc-900 text-center">
          {/* Error icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
            {t("auth.error")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            {getErrorMessage()}
          </p>

          <Link
            href="/auth"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t("auth.tryAgain")}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-zinc-950">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </main>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
