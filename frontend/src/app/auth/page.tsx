"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";
import DocTalkLogo from "../../components/DocTalkLogo";
import { AuthFormContent } from "../../components/AuthFormContent";

function AuthContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { t } = useLocale();

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-zinc-950">
      <div className="max-w-sm w-full">
        {/* Logo / Wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <DocTalkLogo size={32} />
          <span className="font-logo font-semibold text-2xl text-zinc-900 dark:text-zinc-50">DocTalk</span>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm bg-white dark:bg-zinc-900">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {t("auth.signIn")}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
              {t("auth.signInSubtitle")}
            </p>
          </div>

          <AuthFormContent callbackUrl={callbackUrl} />
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-zinc-950">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </main>
    }>
      <AuthContent />
    </Suspense>
  );
}
