"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";
import DocTalkLogo from "../../components/DocTalkLogo";
import { AuthFormContent } from "../../components/AuthFormContent";
import { LoadingScreen } from "../../components/ui/LoadingScreen";

function AuthContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { t, tOr } = useLocale();
  const isDocumentContinuation =
    callbackUrl.includes("/d/") ||
    callbackUrl.includes("/collections") ||
    callbackUrl.includes("/document-diff");
  const subtitle = isDocumentContinuation
    ? tOr("auth.continueSubtitle", "Sign in to save this workflow, upload your own documents, and return to citations across devices.")
    : tOr("auth.panelSubtitle", "Choose a sign-in method to return to your private document workspace.");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-[440px] rounded-lg border border-zinc-200 bg-white p-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.4)]">
        <Link
          href="/"
          aria-label={tOr("auth.backHome", "Back home")}
          className="mb-6 inline-flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
        >
          <DocTalkLogo size={26} />
          <span className="font-logo text-lg font-semibold text-zinc-900 dark:text-zinc-50">DocTalk</span>
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            BETA
          </span>
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {tOr("auth.signIn", "Sign in")}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </p>

        <div className="mt-6">
          <AuthFormContent callbackUrl={callbackUrl} />
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthContent />
    </Suspense>
  );
}
