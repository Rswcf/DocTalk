"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "../../../i18n";
import DocTalkLogo from "../../../components/DocTalkLogo";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { trackEvent } from "../../../lib/analytics";

/**
 * Anti-prefetch interstitial for email magic links.
 *
 * Corporate mail security gateways (Mimecast/Proofpoint class) prefetch links
 * in inbound email. The sign-in email therefore links HERE instead of the raw
 * Auth.js callback URL; the one-time token is only redeemed when a human
 * clicks the button below. A scanner's GET on this page has no side effects,
 * so it no longer consumes the token (dead links) or creates ghost accounts.
 */

/** Only same-origin Auth.js callback URLs may be continued to — anything else
 * would make this page an open redirect. */
function validateCallback(cb: string | null, origin: string): string | null {
  if (!cb) return null;
  try {
    const parsed = new URL(cb, origin);
    if (parsed.origin !== origin) return null;
    if (!parsed.pathname.startsWith("/api/auth/callback/")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function ConfirmContent() {
  const searchParams = useSearchParams();
  const { tOr } = useLocale();
  const [origin, setOrigin] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const target = useMemo(
    () => (origin ? validateCallback(searchParams.get("cb"), origin) : null),
    [origin, searchParams],
  );

  useEffect(() => {
    if (origin) {
      trackEvent("auth_confirm_viewed", { valid: target ? 1 : 0 });
    }
  }, [origin, target]);

  const handleContinue = () => {
    if (!target || continuing) return;
    setContinuing(true);
    trackEvent("auth_confirm_clicked", {});
    window.location.assign(target);
  };

  if (!origin) return <LoadingScreen />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-[440px] rounded-lg border border-zinc-200 bg-white p-7 text-center shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center justify-center gap-2">
          <DocTalkLogo size={26} />
          <span className="font-logo text-lg font-semibold text-zinc-900 dark:text-zinc-50">DocTalk</span>
        </div>
        {target ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {tOr("authConfirm.title", "Confirm your sign-in")}
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              {tOr(
                "authConfirm.body",
                "Click the button below to finish signing in to DocTalk. This extra step keeps automated email scanners from using your sign-in link.",
              )}
            </p>
            <button
              type="button"
              onClick={handleContinue}
              disabled={continuing}
              className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
            >
              {continuing
                ? tOr("authConfirm.continuing", "Signing you in…")
                : tOr("authConfirm.cta", "Sign in to DocTalk")}
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {tOr("authConfirm.invalidTitle", "This sign-in link is not valid")}
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              {tOr(
                "authConfirm.invalidBody",
                "The link may be incomplete or expired. Request a new sign-in email to continue.",
              )}
            </p>
            <Link
              href="/auth"
              className="inline-block w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800"
            >
              {tOr("authConfirm.requestNew", "Request a new link")}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ConfirmContent />
    </Suspense>
  );
}
