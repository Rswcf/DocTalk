"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, FileCheck2, ShieldCheck } from "lucide-react";
import { useLocale } from "../../i18n";
import DocTalkLogo from "../../components/DocTalkLogo";
import { AuthFormContent } from "../../components/AuthFormContent";
import { LoadingScreen } from "../../components/ui/LoadingScreen";

function AuthContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { t, tOr } = useLocale();
  const isDocumentContinuation = callbackUrl.includes("/d/") || callbackUrl.includes("/collections") || callbackUrl.includes("/document-diff");
  const benefits = [
    {
      icon: FileCheck2,
      title: tOr("auth.benefit.uploads.title", "Keep document history"),
      body: tOr("auth.benefit.uploads.body", "Return to uploaded files, parsed status, and previous conversations."),
    },
    {
      icon: BookOpen,
      title: tOr("auth.benefit.citations.title", "Save cited answers"),
      body: tOr("auth.benefit.citations.body", "Preserve source-backed answers so you can verify them later."),
    },
    {
      icon: ShieldCheck,
      title: tOr("auth.benefit.privacy.title", "Control your data"),
      body: tOr("auth.benefit.privacy.body", "Documents are private to your account and can be deleted when you are done."),
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--page-background)] px-6 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <Link href="/" className="mb-6 inline-flex w-fit items-center gap-2.5 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm lg:mb-10">
          <DocTalkLogo size={32} />
          <span className="font-logo text-2xl font-semibold text-zinc-900 dark:text-zinc-50">DocTalk</span>
        </Link>

        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_430px]">
          <section className="order-2 max-w-2xl lg:order-1">
            <div className="hidden lg:block">
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {isDocumentContinuation
                  ? tOr("auth.continueEyebrow", "Continue workspace")
                  : tOr("auth.accessEyebrow", "Account access")}
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                {isDocumentContinuation
                  ? tOr("auth.continueTitle", "Keep reading with your cited answers.")
                  : t("auth.signIn")}
              </h1>
              <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                {isDocumentContinuation
                  ? tOr("auth.continueSubtitle", "Sign in to save this workflow, upload your own documents, and return to citations across devices.")
                  : t("auth.signInSubtitle")}
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {benefits.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-accent-light text-accent">
                    <Icon aria-hidden="true" size={18} />
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
                  <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:block">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {tOr("auth.preview.label", "Saved workflow")}
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {tOr("auth.preview.private", "Private")}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[0.8fr_1fr]">
                <div className="rounded-lg bg-[#f4f1ea] p-3 dark:bg-[#181713]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">document.pdf</span>
                    <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">p. 12</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded bg-zinc-300 dark:bg-zinc-700" />
                    <div className="h-1.5 w-10/12 rounded bg-zinc-300 dark:bg-zinc-700" />
                    <div className="h-4 w-full rounded bg-amber-200/75 dark:bg-amber-400/30" />
                    <div className="h-1.5 w-8/12 rounded bg-zinc-300 dark:bg-zinc-700" />
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                    {tOr("auth.preview.answer", "Your answer stays connected to the source passage")}
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded bg-accent px-1.5 align-baseline text-xs font-bold text-accent-foreground">
                      1
                    </span>
                  </p>
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    {tOr("auth.preview.source", "Source 1 - Document - p. 12")}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="order-1 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 lg:order-2">
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                {t("auth.signIn")}
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-300">
                {t("auth.signInSubtitle")}
              </p>
            </div>

            <AuthFormContent callbackUrl={callbackUrl} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <LoadingScreen />
    }>
      <AuthContent />
    </Suspense>
  );
}
