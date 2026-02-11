"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale } from "../i18n";

interface AuthFormContentProps {
  callbackUrl: string;
}

export function AuthFormContent({ callbackUrl }: AuthFormContentProps) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    try {
      await signIn("resend", { email: email.trim(), callbackUrl, redirect: false });
      setSentEmail(email.trim());
      setEmailSent(true);
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await signIn("resend", { email: sentEmail, callbackUrl, redirect: false });
    } finally {
      setSending(false);
    }
  };

  const handleUseDifferentEmail = () => {
    setEmailSent(false);
    setEmail("");
    setSentEmail("");
  };

  const oauthButtonClass =
    "w-full flex items-center justify-center gap-3 px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900";

  return (
    <div className="space-y-3">
      {/* Google OAuth */}
      <button
        onClick={() => signIn("google", { callbackUrl })}
        className={oauthButtonClass}
      >
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <span className="text-zinc-700 dark:text-zinc-200">{t("auth.continueWithGoogle")}</span>
      </button>

      {/* Microsoft OAuth */}
      <button
        onClick={() => signIn("microsoft-entra-id", { callbackUrl })}
        className={oauthButtonClass}
      >
        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 21 21">
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
        <span className="text-zinc-700 dark:text-zinc-200">{t("auth.continueWithMicrosoft")}</span>
      </button>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400 dark:text-zinc-500">
            {t("auth.orDivider")}
          </span>
        </div>
      </div>

      {/* Email Magic Link */}
      {emailSent ? (
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {t("auth.checkEmail")}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("auth.emailSent").replace("{email}", sentEmail)}
          </p>
          <div className="flex items-center justify-center gap-3 text-sm">
            <button
              onClick={handleResend}
              disabled={sending}
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {t("auth.resendEmail")}
            </button>
            <span className="text-zinc-300 dark:text-zinc-600">|</span>
            <button
              onClick={handleUseDifferentEmail}
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 underline underline-offset-2 transition-colors"
            >
              {t("auth.useDifferentEmail")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            required
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 transition-shadow"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {sending ? t("common.loading") : t("auth.continueWithEmail")}
          </button>
        </form>
      )}

      {/* Terms + Privacy */}
      <p className="text-xs text-center text-zinc-400 dark:text-zinc-500 mt-4">
        {t("auth.termsNotice").split("Terms of Service")[0]}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Terms of Service</a>
        {" and "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Privacy Policy</a>.
      </p>

      {/* AI disclosure + free credits */}
      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 text-center space-y-2">
        <p className="text-xs text-zinc-400">
          {t("auth.aiDisclosure")}
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
          {t("auth.freeCredits")}
        </p>
      </div>
    </div>
  );
}
