# UI Redesign Phase 3: Demo + Billing + Auth + AuthModal Restyle

## Task
Restyle the Demo page, Billing page, Auth page, and AuthModal to match the new monochrome zinc-based SaaS aesthetic established in Phase 1-2.

## Important Context
- Color palette: zinc-based (zinc-900 primary, zinc-200 borders, zinc-950 dark bg)
- Primary buttons: `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
- Border style: `border-zinc-200 dark:border-zinc-800`
- Page background: `bg-white dark:bg-zinc-950`
- Card style: `rounded-xl border border-zinc-200 dark:border-zinc-800`
- Header is imported from `../../components/Header` with `variant` prop (`'minimal'` | `'full'`)
- i18n hook: `useLocale()` from `../../i18n`
- All components are `"use client"`

## File Changes

### 1. `frontend/src/app/demo/page.tsx` — Restyle

Changes from current:
- Background: `bg-white dark:bg-zinc-950` (not gray-50)
- Use `<Header variant="minimal" />`
- Cards: remove blue accent hover → `hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-lg`
- Icon backgrounds: `bg-zinc-100 dark:bg-zinc-800`, icons `text-zinc-600 dark:text-zinc-400` (not blue)
- Title hover: `group-hover:text-zinc-600` (not blue-600)
- Heading: `text-3xl font-bold` (bigger)
- Larger section spacing

Full rewrite:

```tsx
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, BookOpen, FileSignature, Loader2 } from 'lucide-react';
import { useLocale } from '../../i18n';
import Header from '../../components/Header';
import { getDemoDocuments, type DemoDocument } from '../../lib/api';

const SAMPLE_CONFIG: Record<string, { icon: typeof FileText; titleKey: string; descKey: string; questionKey: string }> = {
  'nvidia-10k': {
    icon: FileText,
    titleKey: 'demo.sample.10k.title',
    descKey: 'demo.sample.10k.desc',
    questionKey: 'demo.sample.10k.question',
  },
  'attention-paper': {
    icon: BookOpen,
    titleKey: 'demo.sample.paper.title',
    descKey: 'demo.sample.paper.desc',
    questionKey: 'demo.sample.paper.question',
  },
  'nda-contract': {
    icon: FileSignature,
    titleKey: 'demo.sample.contract.title',
    descKey: 'demo.sample.contract.desc',
    questionKey: 'demo.sample.contract.question',
  },
};

export default function DemoPage() {
  const { t } = useLocale();
  const [docs, setDocs] = useState<DemoDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDemoDocuments()
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header variant="minimal" />
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">{t('demo.title')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-10 text-center max-w-md">
          {t('demo.subtitle')}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="animate-spin" size={20} />
            <span>{t('common.loading')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
            {docs.map((doc) => {
              const config = SAMPLE_CONFIG[doc.slug];
              if (!config) return null;
              const Icon = config.icon;
              const isReady = doc.status === 'ready';
              return (
                <Link
                  key={doc.slug}
                  href={`/d/${doc.document_id}`}
                  className="flex flex-col p-6 bg-white dark:bg-zinc-950 rounded-xl border
                             border-zinc-200 dark:border-zinc-800 hover:border-zinc-400
                             dark:hover:border-zinc-600 hover:shadow-lg transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                      <Icon size={24} className="text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600
                                   dark:group-hover:text-zinc-300 transition-colors">
                      {t(config.titleKey)}
                    </h2>
                    {!isReady && (
                      <span className="ml-auto text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                        {t('demo.processing')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {t(config.descKey)}
                  </p>
                  <div className="mt-auto pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                      &ldquo;{t(config.questionKey)}&rdquo;
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
          {t('demo.hint')}
        </p>

        <Link href="/" className="mt-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm transition-colors">
          &larr; {t('demo.backToHome')}
        </Link>
      </div>
    </div>
  );
}
```

### 2. `frontend/src/app/billing/page.tsx` — Restyle

Changes:
- Pro card: gradient `from-zinc-800 to-zinc-900` border (not blue-indigo)
- Upgrade button: `bg-zinc-900 text-white` (not blue)
- Credit pack cards: refined borders, rounded-xl
- Purchase buttons: `bg-zinc-900` (not blue)
- Messages: neutral zinc styling (not blue bg)
- Background: `bg-white dark:bg-zinc-950`

Full rewrite:

```tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";
import Header from "../../components/Header";
import { getUserProfile, createSubscription, createPortalSession } from "../../lib/api";
import type { UserProfile } from "../../types";

interface Product {
  id: string;
  credits: number;
  price_usd: number;
}

function BillingContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (searchParams.get("success")) {
      setMessage(t("billing.purchaseSuccess"));
    } else if (searchParams.get("canceled")) {
      setMessage(t("billing.purchaseCanceled"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/billing");
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchProducts() {
      const res = await fetch("/api/proxy/api/billing/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const p = await getUserProfile();
        setProfile(p);
      } catch (e) {}
    }
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status]);

  const handlePurchase = async (packId: string) => {
    setLoading(packId);
    try {
      const res = await fetch(`/api/proxy/api/billing/checkout?pack_id=${packId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.checkout_url;
      } else {
        setMessage(t("billing.error"));
      }
    } catch (e) {
      setMessage(t("billing.error"));
    }
    setLoading(null);
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />
      <main className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
          {t("billing.title")}
        </h1>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            {message}
          </div>
        )}

        {/* Subscription Card */}
        <section className="mb-8">
          <div className="rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 p-[1px]">
            <div className="rounded-xl bg-white dark:bg-zinc-950 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("billing.pro.title")}</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t("billing.pro.description")}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {t("billing.pro.pricePerMonth", { price: 9.99 })}
                  </div>
                  <div className="mt-3">
                    {profile?.plan === "pro" ? (
                      <button
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            const res = await createPortalSession();
                            window.location.href = res.portal_url;
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all duration-200"
                      >
                        {t("profile.plan.manage")}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            const res = await createSubscription();
                            window.location.href = res.checkout_url;
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all duration-200"
                      >
                        {t("profile.plan.upgrade")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <h2 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wide">
          {t("billing.extraTopups")}
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col hover:shadow-md transition-all duration-200"
            >
              <h3 className="text-lg font-medium capitalize text-zinc-900 dark:text-zinc-100">
                {product.id}
              </h3>
              <p className="text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">
                ${product.price_usd}
              </p>
              <p className="text-zinc-500 mt-1">
                {product.credits.toLocaleString()} {t("credits.credits")}
              </p>
              <button
                onClick={() => handlePurchase(product.id)}
                disabled={loading === product.id}
                className="mt-auto pt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all duration-200"
              >
                {loading === product.id ? t("common.loading") : t("billing.purchase")}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
          <div className="animate-pulse text-zinc-500">Loading...</div>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
```

### 3. `frontend/src/app/auth/page.tsx` — Restyle

Changes:
- Add DocTalk wordmark above sign-in card
- Card: subtle border, rounded-2xl, shadow-sm
- Google button: cleaner border, rounded-lg
- Heading: text-3xl
- Background: `bg-white dark:bg-zinc-950`
- More premium spacing

```tsx
"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";

function AuthContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { t } = useLocale();

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-white dark:bg-zinc-950">
      <div className="max-w-sm w-full">
        {/* Logo / Wordmark */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">DocTalk</h2>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {t("auth.signIn")}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
              {t("auth.signInSubtitle")}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-zinc-700 dark:text-zinc-200 font-medium">{t("auth.continueWithGoogle")}</span>
            </button>
          </div>

          <p className="text-xs text-center text-zinc-400 mt-6">
            {t("auth.termsNotice")}
          </p>
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
```

### 4. `frontend/src/components/AuthModal.tsx` — Restyle

Changes:
- Overlay: `bg-black/60` (darker)
- Card: `rounded-2xl`, larger padding (p-8), zinc borders
- CTA styling: zinc-based buttons
- Remove emoji from privacy note and credits text
- Background: zinc-based

```tsx
"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { X } from 'lucide-react';
import { useLocale } from '../i18n';

export function AuthModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();

  const isOpen = searchParams.get('auth') === '1';

  if (!isOpen) return null;

  const handleClose = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const handleGoogleLogin = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    signIn('google', { callbackUrl: url.toString() });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md mx-4 shadow-xl border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="auth-modal-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {t('auth.loginToContinue')}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          {t('auth.loginBenefits')}
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3
                     hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-zinc-700 dark:text-zinc-200">Continue with Google</span>
        </button>

        <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center space-y-2">
          <p className="text-xs text-zinc-400">
            {t('auth.privacyNote')}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
            {t('auth.freeCredits')}
          </p>
        </div>
      </div>
    </div>
  );
}
```

## IMPORTANT NOTES
- Replace each file ENTIRELY with the new version provided above.
- All files are `"use client"` components.
- All color classes consistently use `zinc-*` instead of `gray-*` or `blue-*`.
- Dark mode uses `dark:bg-zinc-950` as page background.
- Primary buttons: `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
- Transitions: `transition-all duration-200` on interactive elements.
- Keep ALL existing imports and functional logic intact — only change styling/layout.
