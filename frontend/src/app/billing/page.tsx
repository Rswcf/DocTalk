"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";
import Header from "../../components/Header";
import { getUserProfile, createSubscription, createPortalSession } from "../../lib/api";
import { triggerCreditsRefresh } from "../../components/CreditsDisplay";
import PricingTable from "../../components/PricingTable";
import type { UserProfile } from "../../types";
import type { PlanType } from "../../lib/models";
import { Check } from "lucide-react";

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
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    if (searchParams.get("success")) {
      setMessage(t("billing.purchaseSuccess"));
      triggerCreditsRefresh();
    } else if (searchParams.get("canceled")) {
      setMessage(t("billing.purchaseCanceled"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/billing");
    }
  }, [status, router]);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(false);
    try {
      const res = await fetch("/api/proxy/api/billing/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      } else {
        setProductsError(true);
      }
    } catch {
      setProductsError(true);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  const handleSubscribe = async (plan: string) => {
    setSubmitting(plan);
    try {
      const res = await createSubscription({ plan, billing: billingPeriod });
      window.location.href = res.checkout_url;
    } catch {
      setMessage(t("billing.error"));
    } finally {
      setSubmitting(null);
    }
  };

  const handleManage = async () => {
    setSubmitting('manage');
    try {
      const res = await createPortalSession();
      window.location.href = res.portal_url;
    } finally {
      setSubmitting(null);
    }
  };

  const handleUpgrade = (plan: PlanType) => {
    if (plan === 'free') return;
    handleSubscribe(plan);
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">Loading...</div>;
  }

  const plusFeatures = [
    '30,000 credits/month',
    'All 9 AI models',
    'OCR & Markdown export',
    '20 documents, 50MB files',
  ];

  const proFeatures = [
    '150,000 credits/month',
    'All 9 AI models',
    'Custom prompts & priority support',
    'Unlimited documents, 100MB files',
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />
      <main className="max-w-5xl mx-auto p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
          {t("billing.title")}
        </h1>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            {message}
          </div>
        )}

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t('billing.monthly')}
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t('billing.annual')}
          </button>
        </div>

        {/* Subscription Cards */}
        <section className="mb-8 grid md:grid-cols-2 gap-6">
          {/* Plus Card */}
          <div className="relative rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 p-[2px]">
            <div className="rounded-xl bg-white dark:bg-zinc-950 p-6 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("billing.plus.title")}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium">
                  {t("billing.mostPopular")}
                </span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{t("billing.plus.description")}</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                  {billingPeriod === 'monthly' ? '$7.99' : '$5.99'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-1">
                  /{billingPeriod === 'monthly' ? 'mo' : 'mo'}
                </span>
                {billingPeriod === 'annual' && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                    {t('billing.savePercent', { percent: 25 })}
                  </span>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plusFeatures.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {profile?.plan === 'plus' ? (
                <button
                  onClick={handleManage}
                  disabled={submitting === 'manage'}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {t("billing.manage")}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe('plus')}
                  disabled={submitting === 'plus'}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium"
                >
                  {submitting === 'plus' ? t("common.loading") : `${t("billing.upgrade")} Plus`}
                </button>
              )}
            </div>
          </div>

          {/* Pro Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{t("billing.pro.title")}</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{t("billing.pro.description")}</p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {billingPeriod === 'monthly' ? '$14.99' : '$11.99'}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-1">
                /mo
              </span>
              {billingPeriod === 'annual' && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                  {t('billing.savePercent', { percent: 20 })}
                </span>
              )}
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {proFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {profile?.plan === 'pro' ? (
              <button
                onClick={handleManage}
                disabled={submitting === 'manage'}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium"
              >
                {t("billing.manage")}
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe('pro')}
                disabled={submitting === 'pro'}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium"
              >
                {submitting === 'pro' ? t("common.loading") : `${t("billing.upgrade")} Pro`}
              </button>
            )}
          </div>
        </section>

        {/* Pricing Comparison */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wide">
            {t("billing.comparison.title")}
          </h2>
          <PricingTable currentPlan={profile?.plan as PlanType || 'free'} onUpgrade={handleUpgrade} />
        </section>

        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wide">
          {t("billing.extraTopups")}
        </h2>

        {productsLoading && (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-6 animate-pulse">
                <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-24 mb-4" />
                <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-16 mb-2" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32 mb-4" />
                <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded mt-4" />
              </div>
            ))}
          </div>
        )}

        {productsError && !productsLoading && (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <p>{t("billing.error")}</p>
            <button
              onClick={fetchProducts}
              className="mt-2 text-sm underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {!productsLoading && !productsError && (
          <div className="grid md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  {t(`billing.pack.${product.id}` as any)}
                </h3>
                <p className="text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">
                  ${product.price_usd}
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  {product.credits.toLocaleString()} {t("credits.credits")}
                </p>
                <button
                  onClick={() => handlePurchase(product.id)}
                  disabled={loading === product.id}
                  className="mt-auto pt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors"
                >
                  {loading === product.id ? t("common.loading") : t("billing.purchase")}
                </button>
              </div>
            ))}
          </div>
        )}
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
