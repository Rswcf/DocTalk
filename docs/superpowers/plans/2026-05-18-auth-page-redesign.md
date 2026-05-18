# Auth Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI-flavored two-column `/auth` page with a minimal centered login card matching Google Stitch's aesthetic, and decouple the shared `AuthFormContent` from the `dt-stitch-theme` container.

**Architecture:** Remove the `dt-stitch-theme` wrapper from `/auth` (which deletes all gradient/glow/dot-grid CSS at once), rewrite the page as a single centered card on a faint solid background, and restyle `AuthFormContent` with self-contained zinc+indigo Tailwind classes so it renders correctly both on the page and inside `AuthModal`. A Google Stitch MCP step generates reference variants before the polish pass.

**Tech Stack:** Next.js 14 (App Router, all client components), Tailwind CSS, Auth.js v5, lucide-react, Google Stitch MCP.

**Spec:** `docs/superpowers/specs/2026-05-18-auth-page-redesign-design.md`

**Note on testing:** This is a presentational change with no unit-testable logic (auth behavior is untouched). The verification contract per task is `cd frontend && npm run build` passing, plus the manual browser golden path defined in Task 5. There are no new automated tests.

---

## Branch setup (do this first)

The repo is on the default branch `main` with a dirty tree. Before any task:

- [ ] Create and switch to a feature branch:

```bash
cd /Users/mayijie/Projects/Code/010_DocTalk
git checkout -b auth-page-redesign
```

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `frontend/src/app/auth/page.tsx` | The `/auth` route — minimal centered card shell | Rewrite |
| `frontend/src/components/AuthFormContent.tsx` | Shared sign-in form (OAuth + magic link), used by page and modal | Restyle + decouple |
| `frontend/src/app/globals.css` | Global styles | Delete `.dt-auth-*` rule blocks |
| `frontend/src/components/AuthModal.tsx` | Sign-in modal reusing `AuthFormContent` | Verify; tweak only if needed |

No new i18n keys are expected. `DocTalkLogo` and `LoadingScreen` already exist and are reused as-is.

---

## Task 1: Generate login-page variants with Google Stitch MCP

**Files:** none (produces a reference design + selection note)

This task is a checkpoint. The variants MUST respect the locked decisions in the
spec (minimal centered card; faint solid background + borderless soft-shadow
floating card; core content + free-credits hook; zinc + indigo, neutral dark
primary button; light + dark). Stitch output informs only spacing, proportion,
and typographic polish — not structure.

- [ ] **Step 1: Create the Stitch project**

Call the `mcp__stitch__create_project` tool with name `DocTalk Auth Redesign`.
(Load tool schemas first via `ToolSearch` with query `select:mcp__stitch__create_project,mcp__stitch__generate_screen_from_text,mcp__stitch__generate_variants,mcp__stitch__list_screens,mcp__stitch__get_screen`.)

- [ ] **Step 2: Generate the base login screen**

Call `mcp__stitch__generate_screen_from_text` with this prompt:

```
A sign-in screen for "DocTalk", an AI document Q&A web app. Single login card,
vertically and horizontally centered on a faint solid background (no gradients,
no texture, no dot grid). The card is a solid surface with a hairline border and
a soft elevation shadow — it floats on the faint background. Card contents, top
to bottom: a small DocTalk logo + wordmark + "BETA" pill; an "Sign in" heading;
a one-line muted subtitle; a white "Continue with Google" button with the Google
logo; a white "Continue with Microsoft" button with the Microsoft logo; an "or"
divider; an email input; a solid neutral-dark "Continue with email" primary
button; a small "Terms of Service / Privacy Policy" line; and a single
"New users get free starter credits" line under a hairline divider. Style:
clean, minimal, restrained whitespace, flat hierarchy, monochrome zinc palette
with a single indigo accent reserved for focus. No glassmorphism, no marketing
columns, no feature cards, no decorative icons. Provide both light and dark mode.
```

- [ ] **Step 3: Generate 2–3 variants**

Call `mcp__stitch__generate_variants` on the generated screen to produce 2–3
alternatives. Use `mcp__stitch__list_screens` / `mcp__stitch__get_screen` to
retrieve them.

- [ ] **Step 4: Present variants to the user and get a pick**

Show the user the 2–3 Stitch variants and ask which one to use as the reference.
Wait for their selection.

- [ ] **Step 5: Record the selection**

Write the chosen variant identifier and a short bullet list of polish deltas
(spacing, radius, font-size, proportion differences vs the baseline code in
Tasks 2–3) directly below this line in this plan file, then commit:

```bash
git add docs/superpowers/plans/2026-05-18-auth-page-redesign.md
git commit -m "docs: record Stitch variant selection for auth redesign"
```

> **Selected variant:** V3 — "Balanced" (based on the Stitch "Clarity & Precision"
> design theme; hairline border + medium soft shadow). Stitch MCP *screen*
> generation timed out repeatedly, so variants were rendered via the brainstorming
> visual companion. The Stitch *design theme* (project `5259146892895154770`) is the
> authoritative style reference: bg `#F9FAFB`, white cards, hairline `#E5E7EB`,
> pill buttons, primary `#18181B`, indigo `#4F46E5` reserved for focus only.
>
> **Polish deltas to apply in Task 5 (vs. the baseline code in Tasks 2–3):**
> - Card border: `border-zinc-100` → `border-zinc-200` (Stitch hairline `#E5E7EB`).
> - Card shadow: `shadow-[0_18px_48px_-14px_rgba(24,24,27,0.20)]` → `shadow-[0_8px_24px_-10px_rgba(24,24,27,0.12)]`; dark mode → a comparable moderate shadow.
> - Card radius: `rounded-2xl` → `rounded-3xl` (Stitch `rounded-xl` token = 1.5rem = 24px).
> - Email input fill: `bg-white` → `bg-zinc-100 dark:bg-zinc-800` (Stitch input spec = Zinc-100 background).
> - Focus rings: `ring-zinc-400` → `ring-indigo-500` (Stitch reserves indigo `#4F46E5` for focus states).
>
> **Carried-forward a11y fixes from the Task 2 code-quality review (apply in Task 5, same focus-ring lines):**
> - Email input: `focus:ring-2 focus:ring-* focus:ring-offset-*` → `focus-visible:ring-2 focus-visible:ring-* focus-visible:ring-offset-*` (match codebase `focus-visible` convention; `focus:border-*` / `focus:outline-none` stay).
> - `emailSent`-state "Resend email" and "Use a different email" text buttons: add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded-sm` (currently rely on browser default only).
>
> **Carried-forward fixes from the Task 3 code-quality review (apply in Task 5):**
> - `auth/page.tsx` logo `Link` (Important): focus ring is missing the offset — add `focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900` (every other interactive element has it; without it the ring merges into the dark card).
> - `auth/page.tsx` logo `Link`: `transition-opacity` + `hover:opacity-80` dims the indigo logo dots too — change to `transition-colors` (drop `hover:opacity-80`; rely on a text-color hover or no hover).
> - `auth/page.tsx` heading: `t("auth.signIn")` → `tOr("auth.signIn", "Sign in")` to avoid flashing the raw key during locale lazy-load.

---

## Task 2: Decouple and restyle AuthFormContent

**Files:**
- Modify: `frontend/src/components/AuthFormContent.tsx` (full rewrite)

`AuthFormContent` currently uses `var(--workbench-*)`, `bg-white/N`, and
`dt-stitch-primary`, which only resolve correctly inside `.dt-stitch-theme`.
Replace them with self-contained zinc+indigo Tailwind classes. All auth logic
(`getProviders`, magic-link submit, resend cooldown, `emailSent` state, error
states, `trackEvent` calls) is unchanged — only `className` values and the
removal of the AI-disclosure line.

- [ ] **Step 1: Replace the entire file contents**

Replace `frontend/src/components/AuthFormContent.tsx` with exactly:

```tsx
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
    "group flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,background-color] hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 dark:focus-visible:ring-offset-zinc-900";

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
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {t("auth.checkEmail")}
          </h3>
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
              className="text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
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
              className="text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
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
            className="min-h-12 w-full rounded-full border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 transition-[border-color,box-shadow] focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-offset-zinc-900"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="min-h-12 w-full rounded-full bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-offset-zinc-900"
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
```

- [ ] **Step 2: Verify the build passes**

Run: `cd frontend && npm run build`
Expected: build completes with no TypeScript or ESLint errors. (The AI-disclosure
line and `dt-auth-form`/`dt-stitch-primary`/`--workbench-*` references are gone;
no import was removed from this file, so no unused-import error.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AuthFormContent.tsx
git commit -m "refactor(auth): decouple AuthFormContent from dt-stitch-theme"
```

---

## Task 3: Rewrite the /auth page and remove .dt-auth-* CSS

**Files:**
- Modify: `frontend/src/app/auth/page.tsx` (full rewrite)
- Modify: `frontend/src/app/globals.css` (delete one block, ~lines 1057–1099)

- [ ] **Step 1: Replace the entire page file**

Replace `frontend/src/app/auth/page.tsx` with exactly:

```tsx
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
      <div className="w-full max-w-[400px] rounded-2xl border border-zinc-100 bg-white p-7 shadow-[0_18px_48px_-14px_rgba(24,24,27,0.20)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_22px_56px_-14px_rgba(0,0,0,0.7)]">
        <Link
          href="/"
          aria-label={tOr("auth.backHome", "Back home")}
          className="mb-6 inline-flex items-center gap-2 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <DocTalkLogo size={26} />
          <span className="font-logo text-lg font-semibold text-zinc-900 dark:text-zinc-50">DocTalk</span>
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            BETA
          </span>
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("auth.signIn")}
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
```

- [ ] **Step 2: Delete the `.dt-auth-*` CSS block**

In `frontend/src/app/globals.css`, delete the entire block below (currently
around lines 1057–1099). It begins with `.dt-auth-page {` and ends with the
closing brace of `.dark .dt-auth-card`. Delete exactly:

```css
.dt-auth-page {
  overflow: hidden;
}

.dt-auth-brand,
.dt-auth-proof {
  border: 1px solid var(--workbench-border);
  background: color-mix(in srgb, var(--workbench-panel) 76%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(22px);
}

.dt-auth-command-panel {
  border: 1px solid var(--workbench-border-strong);
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.2), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(246, 248, 252, 0.88));
  box-shadow: var(--workbench-command-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(30px);
}

.dark .dt-auth-command-panel {
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(28, 29, 34, 0.82), rgba(16, 17, 21, 0.92));
  box-shadow: var(--workbench-command-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.dt-auth-card {
  border: 1px solid var(--workbench-border-strong);
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.24), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(246, 248, 252, 0.94));
  box-shadow: 0 30px 90px rgba(31, 55, 88, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(30px);
}

.dark .dt-auth-card {
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.09), transparent 30%),
    linear-gradient(180deg, rgba(28, 29, 34, 0.88), rgba(13, 14, 17, 0.96));
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.07);
}
```

Leave a single blank line where the block was, so `.dt-stitch-card { ... }`
(above) and `.dt-landing-showcase-shell, ...` (below) stay separated. Do NOT
touch `.dt-stitch-theme`, `.dt-stitch-primary`, `.dt-stitch-card`, or any
`.dt-landing-*` rule — those are used by other routes.

- [ ] **Step 3: Confirm no other file references the removed classes or theme**

Run: `cd frontend && grep -rn "dt-auth-\|dt-stitch-theme\|dt-stitch-primary" src/app/auth src/components/AuthFormContent.tsx src/components/AuthModal.tsx`
Expected: no matches. (If any appear, the rewrite in Task 2 or Step 1 above is
incomplete — fix before continuing.)

- [ ] **Step 4: Verify the build passes**

Run: `cd frontend && npm run build`
Expected: build completes with no errors. The new `page.tsx` imports only
`Suspense`, `Link`, `useSearchParams`, `useLocale`, `DocTalkLogo`,
`AuthFormContent`, `LoadingScreen` — all used, so no unused-import error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/auth/page.tsx frontend/src/app/globals.css
git commit -m "feat(auth): rewrite /auth as minimal centered card"
```

---

## Task 4: Verify AuthModal with the decoupled form

**Files:**
- Modify (only if needed): `frontend/src/components/AuthModal.tsx`

`AuthModal`'s shell already uses `bg-white dark:bg-zinc-900` with
`border-zinc-200 dark:border-zinc-800` — the same surface color the restyled
`AuthFormContent` divider span assumes (`bg-white dark:bg-zinc-900`). So no
change is expected. This task confirms that.

- [ ] **Step 1: Read AuthModal and confirm surface consistency**

Open `frontend/src/components/AuthModal.tsx`. Confirm the modal content
container is `bg-white dark:bg-zinc-900`. If it is, the divider span in
`AuthFormContent` will correctly mask the divider line. No edit needed —
proceed to Step 3.

- [ ] **Step 2: (Only if the modal surface differs) align the divider**

If and only if the modal surface is NOT `bg-white dark:bg-zinc-900`, adjust the
modal content container to `bg-white dark:bg-zinc-900` so the `AuthFormContent`
`or` divider renders cleanly. Do not change anything else.

- [ ] **Step 3: Verify the build passes**

Run: `cd frontend && npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit (only if Step 2 made a change)**

```bash
git add frontend/src/components/AuthModal.tsx
git commit -m "fix(auth): align AuthModal surface with decoupled form"
```

If Step 2 made no change, skip this commit.

---

## Task 5: Polish pass and full verification

**Files:** any of the Task 2–3 files, for spacing/proportion polish only.

- [ ] **Step 1: Apply Stitch-derived polish deltas**

Using the variant selected in Task 1 (and its recorded polish deltas), adjust
only spacing, border-radius, font-size, and proportion values in `page.tsx` /
`AuthFormContent.tsx`. Do NOT reintroduce gradients, glassmorphism, texture, the
marketing column, feature cards, or decorative icons — those are out of scope by
the spec's decisions table.

- [ ] **Step 2: Verify the build passes**

Run: `cd frontend && npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Run the browser golden path**

Start the dev server (`cd frontend && npm run dev`) and verify, in both light
and dark mode:

1. `/auth` page renders as a single centered card on a faint solid background.
2. Google and Microsoft buttons render with logos and are styled.
3. Email input + "Continue with email" submit works; submitting shows the
   `emailSent` "Check your email" state with resend + "use a different email".
4. The Terms/Privacy line and the single free-credits line render; there is NO
   AI-disclosure line, NO decorative lock icon, NO "Secure account access" label.
5. Open the sign-in modal (`AuthModal`) on any page and confirm the form inside
   renders correctly — OAuth buttons, `or` divider, email input all visible and
   styled (this is the decoupling fix).
6. AI-cliché checklist — confirm NONE remain: gradient washes, dot-grid
   background, glassmorphism panels, fake command panel, three-up benefit cards,
   Sparkles eyebrow pill, oversized hero headline.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src
git commit -m "style(auth): polish login card to Stitch reference"
```

- [ ] **Step 5: Stop the dev server**

Stop the `npm run dev` process started in Step 3.

---

## Self-review notes

- **Spec coverage:** layout (Task 3), background option B (Task 3 page + globals
  removal), card content incl. free-credits hook / dropped AI-disclosure
  (Task 2), AuthFormContent decoupling (Task 2), AuthModal consistency (Task 4),
  Stitch variant step (Task 1), i18n zero-new-keys (reused keys throughout),
  verification (Task 5) — all mapped.
- **i18n:** every `t()`/`tOr()` key used (`auth.signIn`, `auth.panelSubtitle`,
  `auth.continueSubtitle`, `auth.backHome`, `auth.continueWith*`,
  `auth.orDivider`, `auth.emailPlaceholder`, `auth.checkEmail`, `auth.emailSent`,
  `auth.checkSpamHint`, `auth.resend*`, `auth.useDifferentEmail`,
  `auth.terms*`/`and`/`privacyPolicy`, `auth.freeCredits`, `auth.noProviders`,
  `auth.emailUnavailable`, `auth.unexpectedError`, `auth.resendFailed`,
  `common.loading`) already exists in the locale files or is guarded by `tOr`
  with a fallback. No new key is added, so the 11-locale rule is not triggered.
