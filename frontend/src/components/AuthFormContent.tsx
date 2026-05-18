"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useLocale } from "../i18n";
import { trackEvent } from "../lib/analytics";

interface AuthFormContentProps {
  callbackUrl: string;
  surface?: "page" | "modal";
}

export function AuthFormContent({ callbackUrl, surface = "page" }: AuthFormContentProps) {
  const { t, tOr } = useLocale();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean> | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getProviders()
      .then((providers) => {
        if (cancelled) return;
        setAvailableProviders(Object.fromEntries(
          Object.keys(providers || {}).map((providerId) => [providerId, true])
        ));
      })
      .catch(() => {
        if (!cancelled) setAvailableProviders({});
      });

    return () => {
      cancelled = true;
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const authEventSource = `auth_${surface}`;

  const handleProviderSignIn = (provider: "google" | "microsoft-entra-id") => {
    trackEvent("auth_provider_clicked", {
      source: authEventSource,
      provider,
    });
    void signIn(provider, { callbackUrl });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError("");
    trackEvent("auth_email_link_requested", {
      source: authEventSource,
      reason: "initial",
    });
    try {
      const result = await signIn("resend", { email: email.trim(), callbackUrl, redirect: false });
      if (result?.error) {
        trackEvent("auth_email_link_failed", {
          source: authEventSource,
          reason: result.error,
        });
        setError(result.error === "Configuration"
          ? t("auth.emailUnavailable")
          : result.error);
        return;
      }
      trackEvent("auth_email_link_sent", {
        source: authEventSource,
        reason: "initial",
      });
      setSentEmail(email.trim());
      setEmailSent(true);
    } catch (err) {
      trackEvent("auth_email_link_failed", {
        source: authEventSource,
        reason: "unexpected",
      });
      setError(t("auth.unexpectedError"));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (sending || cooldown > 0 || resendCount >= 3) return;
    setSending(true);
    setError("");
    trackEvent("auth_email_link_requested", {
      source: authEventSource,
      reason: "resend",
    });
    try {
      const result = await signIn("resend", { email: sentEmail, callbackUrl, redirect: false });
      if (result?.error) {
        trackEvent("auth_email_link_failed", {
          source: authEventSource,
          reason: result.error,
        });
        setError(t("auth.resendFailed"));
      } else {
        trackEvent("auth_email_link_sent", {
          source: authEventSource,
          reason: "resend",
        });
        setResendCount((prev) => prev + 1);
        startCooldown();
      }
    } catch (err) {
      trackEvent("auth_email_link_failed", {
        source: authEventSource,
        reason: "unexpected",
      });
      setError(t("auth.unexpectedError"));
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
    "group flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,background-color] hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 dark:focus-visible:ring-offset-zinc-900";

  const providersLoaded = availableProviders !== null;
  const hasGoogle = !!availableProviders?.google;
  const hasMicrosoft = !!availableProviders?.["microsoft-entra-id"];
  const hasEmail = !!availableProviders?.resend;
  const hasAnyOAuth = hasGoogle || hasMicrosoft;
  const hasAnyProvider = hasAnyOAuth || hasEmail;

  return (
    <div className="space-y-3">
      {providersLoaded && !hasAnyProvider && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {tOr("auth.noProviders", "No sign-in methods are currently available. Please contact support.")}
        </div>
      )}

      {hasGoogle && (
        <button
          onClick={() => handleProviderSignIn("google")}
          className={oauthButtonClass}
        >
          <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>{t("auth.continueWithGoogle")}</span>
        </button>
      )}

      {hasMicrosoft && (
        <button
          onClick={() => handleProviderSignIn("microsoft-entra-id")}
          className={oauthButtonClass}
        >
          <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
          </svg>
          <span>{t("auth.continueWithMicrosoft")}</span>
        </button>
      )}

      {/* Divider */}
      {hasAnyOAuth && hasEmail && (
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-3 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {t("auth.orDivider")}
            </span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Email Magic Link */}
      {hasEmail && (emailSent ? (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
            <svg className="h-6 w-6 text-zinc-900 dark:text-zinc-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {t("auth.checkEmail")}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("auth.emailSent").replace("{email}", sentEmail)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("auth.checkSpamHint")}
          </p>
          <div className="flex items-center justify-center gap-3 text-sm">
            <button
              onClick={handleResend}
              disabled={sending || cooldown > 0 || resendCount >= 3}
              className="rounded-sm text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:ring-offset-zinc-900"
            >
              {resendCount >= 3
                ? t("auth.resendMaxReached")
                : cooldown > 0
                  ? t("auth.resendCooldown").replace("{seconds}", String(cooldown))
                  : t("auth.resendEmail")}
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <button
              onClick={handleUseDifferentEmail}
              className="rounded-sm text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:ring-offset-zinc-900"
            >
              {t("auth.useDifferentEmail")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <label htmlFor="auth-email" className="sr-only">
            {t("auth.emailPlaceholder")}
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            required
            className="min-h-12 w-full rounded-full border border-zinc-200 bg-zinc-100 px-4 py-3 text-zinc-900 placeholder:text-zinc-400 transition-[border-color,box-shadow] focus:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus-visible:ring-offset-zinc-900"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="min-h-12 w-full rounded-full bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-offset-zinc-900"
          >
            {sending ? t("common.loading") : t("auth.continueWithEmail")}
          </button>
        </form>
      ))}

      {/* Terms + Privacy */}
      <p className="mt-4 text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {t("auth.termsPrefix")}{" "}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-50">{t("auth.termsOfService")}</a>
        {" "}{t("auth.and")}{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-50">{t("auth.privacyPolicy")}</a>.
      </p>

      {/* Free credits hook */}
      <div className="mt-4 border-t border-zinc-200 pt-4 text-center dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {t("auth.freeCredits")}
        </p>
      </div>
    </div>
  );
}
