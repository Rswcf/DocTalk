"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";
import Header from "../../components/Header";
import {
  cancelSubscription,
  changePlan,
  createSubscription,
  createPortalSession,
} from "../../lib/api";
import { triggerCreditsRefresh } from "../../components/CreditsDisplay";
import PricingTable from "../../components/PricingTable";
import { PLAN_HIERARCHY, type PlanType } from "../../lib/models";
import { Check } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useUserProfile } from "../../lib/useUserProfile";

interface Product {
  id: string;
  credits: number;
  price_usd: number;
}

function BillingContent() {
  const { t, locale } = useLocale();
  usePageTitle(t("footer.pricing"));

  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useUserProfile();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'pro'>('plus');
  const [confirmDowngrade, setConfirmDowngrade] = useState<{ plan: string; billing: string } | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState<{ plan: string; billing: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    const isSuccess = searchParams.get("success");
    const isCanceled = searchParams.get("canceled");

    if (isSuccess) {
      setMessage(t("billing.purchaseSuccess"));
      triggerCreditsRefresh();
      void refetchProfile();
    } else if (isCanceled) {
      setMessage(t("billing.purchaseCanceled"));
    }

    if (isSuccess || isCanceled) {
      router.replace("/billing", { scroll: false });
    }
  }, [searchParams, t, refetchProfile, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/billing");
    }
  }, [status, router]);

  useEffect(() => {
    if (!confirmUpgrade && !confirmDowngrade && !confirmCancel) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmUpgrade(null);
        setConfirmDowngrade(null);
        setConfirmCancel(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [confirmUpgrade, confirmDowngrade, confirmCancel]);

  useEffect(() => {
    if (!confirmUpgrade && !confirmDowngrade && !confirmCancel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmUpgrade, confirmDowngrade, confirmCancel]);

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

  const handlePurchase = async (packId: string) => {
    if (submitting) return;
    setLoading(packId);
    try {
      const res = await fetch(`/api/proxy/api/billing/checkout?pack_id=${packId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.checkout_url;
        return;
      } else {
        setMessage(t("billing.error"));
      }
    } catch {
      setMessage(t("billing.error"));
    }
    setLoading(null);
  };

  const handleSubscribe = async (plan: 'plus' | 'pro') => {
    if (submitting) return;
    setSubmitting(plan);
    try {
      const res = await createSubscription({ plan, billing: billingPeriod });
      window.location.href = res.checkout_url;
      return;
    } catch {
      setMessage(t("billing.error"));
      setSubmitting(null);
    }
  };

  const getBillingErrorMessage = (error: unknown) => {
    // Prefer structured ApiError.detail (new error-taxonomy shape) — the
    // legacy regex below only matches bare-string detail payloads, so any
    // future migration of billing.py to { error, message } detail would
    // silently fall through without this check.
    if (error && typeof error === "object") {
      const maybeApi = error as { detail?: unknown };
      if (maybeApi.detail && typeof maybeApi.detail === "object") {
        const d = maybeApi.detail as Record<string, unknown>;
        if (typeof d.message === "string" && d.message.length > 0) {
          if (d.message.includes("Cannot switch billing interval during beta")) {
            return t("billing.intervalMismatch");
          }
          return d.message;
        }
        if (typeof d.error === "string") return d.error;
      }
    }

    const raw = error instanceof Error ? error.message : String(error || "");
    if (raw.includes("Cannot switch billing interval during beta")) {
      return t("billing.intervalMismatch");
    }
    // Legacy: extract backend string detail for any billing.py endpoint
    // that still returns `{ detail: "..." }` (scope-out in Phase 1).
    const detailMatch = raw.match(/"detail"\s*:\s*"([^"]+)"/);
    if (detailMatch) {
      return detailMatch[1];
    }
    return t("billing.error");
  };

  const handlePlanAction = async (plan: PlanType) => {
    if (submitting) return;
    if (plan === 'free') return;
    const currentPlan = (profile?.plan || 'free') as PlanType;

    if (currentPlan === 'free') {
      await handleSubscribe(plan);
      return;
    }

    if (currentPlan === plan) {
      return;
    }

    const isUpgrade = PLAN_HIERARCHY[plan] > PLAN_HIERARCHY[currentPlan];
    if (isUpgrade) {
      setConfirmUpgrade({ plan, billing: billingPeriod });
    } else {
      setConfirmDowngrade({ plan, billing: billingPeriod });
    }
  };

  const confirmUpgradeAction = async () => {
    if (!confirmUpgrade) return;
    setSubmitting("confirm-upgrade");
    try {
      const result = await changePlan({
        plan: confirmUpgrade.plan,
        billing: confirmUpgrade.billing,
      });
      triggerCreditsRefresh();
      await refetchProfile();
      if (result.credits_supplemented > 0) {
        setMessage(
          t("billing.upgradeSuccess", {
            credits: result.credits_supplemented.toLocaleString(),
          })
        );
      } else {
        setMessage(t("billing.planChanged"));
      }
      setConfirmUpgrade(null);
    } catch (error) {
      setMessage(getBillingErrorMessage(error));
    } finally {
      setSubmitting(null);
    }
  };

  const confirmDowngradeAction = async () => {
    if (!confirmDowngrade) return;
    setSubmitting("confirm-downgrade");
    try {
      await changePlan({
        plan: confirmDowngrade.plan,
        billing: confirmDowngrade.billing,
      });
      triggerCreditsRefresh();
      await refetchProfile();
      setMessage(t("billing.downgradeSuccess"));
      setConfirmDowngrade(null);
    } catch (error) {
      setMessage(getBillingErrorMessage(error));
    } finally {
      setSubmitting(null);
    }
  };

  const handleManage = async () => {
    if (submitting) return;
    setSubmitting('manage');
    try {
      const res = await createPortalSession();
      window.location.href = res.portal_url;
    } catch (err) {
      // Surface backend error detail instead of generic message (Codex R1 §6).
      setMessage(err instanceof Error && err.message ? err.message : t("billing.error"));
      setSubmitting(null);
    }
  };

  const handleCancel = async () => {
    if (submitting) return;
    setSubmitting('cancel');
    try {
      const res = await cancelSubscription();
      const date = res.effective_at
        ? new Date(res.effective_at).toLocaleDateString(locale)
        : '';
      setMessage(
        res.status === 'scheduled_cancel'
          ? t('billing.cancel.successScheduled', { date })
          : t('billing.cancel.successImmediate')
      );
      setConfirmCancel(false);
      triggerCreditsRefresh();
      await refetchProfile();
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : t('billing.error'));
    } finally {
      setSubmitting(null);
    }
  };

  const handleUpgrade = (plan: PlanType) => {
    if (plan === 'free') return;
    handlePlanAction(plan);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--page-background)]">
        <Header />
        <main id="main-content" className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8">
          <h1 className="sr-only">DocTalk billing</h1>
          <p className="text-zinc-500 dark:text-zinc-400">{t('common.loading')}</p>
        </main>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[var(--page-background)]">
        <Header />
        <main id="main-content" className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8">
          <h1 className="sr-only">DocTalk billing</h1>
          <p className="text-zinc-500 dark:text-zinc-400">{t('common.redirecting')}</p>
        </main>
      </div>
    );
  }

  const plusFeatures = [
    t('billing.features.plusCredits'),
    t('billing.features.allModes'),
    t('billing.features.markdownExport'),
    t('billing.features.plusDocs'),
  ];

  const proFeatures = [
    t('billing.features.proCredits'),
    t('billing.features.allModes'),
    t('billing.features.customPromptsExport'),
    t('billing.features.proDocs'),
  ];

  return (
    <div className="min-h-screen bg-[var(--page-background)]">
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

        {/* Current Plan panel — BGB §312k-compliant cancel button.
            Shown only for paid users (free plan has nothing to manage). */}
        {profile && profile.plan !== 'free' && profile.billing_state && (
          <section
            className="mb-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
            aria-label={t('billing.currentPlan.title')}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  {t('billing.currentPlan.title')}
                </p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {profile.plan === 'plus' ? t('billing.plus.title') : t('billing.pro.title')}
                  <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    · {t(`billing.currentPlan.managed.${profile.billing_state.managed_by}`)}
                  </span>
                </p>
                {profile.billing_state.cancel_at_period_end && profile.billing_state.period_end && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                    {t('billing.currentPlan.scheduledCancel', {
                      date: new Date(profile.billing_state.period_end).toLocaleDateString(locale),
                    })}
                  </p>
                )}
                {!profile.billing_state.cancel_at_period_end &&
                  profile.billing_state.period_end &&
                  profile.billing_state.status === 'active' && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('billing.currentPlan.renewsOn', {
                        date: new Date(profile.billing_state.period_end).toLocaleDateString(locale),
                      })}
                    </p>
                  )}
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-2">
                {profile.billing_state.can_cancel && (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    disabled={submitting !== null}
                    className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  >
                    {profile.billing_state.managed_by === 'admin'
                      ? t('billing.cancel.buttonAdmin')
                      : t('billing.cancel.button')}
                  </button>
                )}
                {profile.billing_state.managed_by === 'stripe' && (
                  <button
                    type="button"
                    onClick={handleManage}
                    disabled={submitting !== null}
                    className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
                  >
                    {t('billing.cancel.managePortal')}
                  </button>
                )}
                {!profile.billing_state.can_cancel && profile.billing_state.status === 'pending' && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs text-right">
                    {t('billing.cancel.tooltipPending')}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingPeriod('monthly')}
            aria-pressed={billingPeriod === 'monthly'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
              billingPeriod === 'monthly'
                ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t('billing.monthly')}
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            aria-pressed={billingPeriod === 'annual'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
              billingPeriod === 'annual'
                ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t('billing.annual')}
          </button>
        </div>

        {profileLoading ? (
          <section className="mb-8 grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-6 animate-pulse"
              >
                <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-24 mb-4" />
                <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-20 mb-2" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32 mb-6" />
                <div className="space-y-2 mb-6">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-4/5" />
                </div>
                <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded" />
              </div>
            ))}
          </section>
        ) : profileError ? (
          <section className="mb-8 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            <p>{profileError}</p>
            <button
              onClick={() => void refetchProfile()}
              className="mt-2 text-sm underline hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
            >
              {t("common.retry")}
            </button>
          </section>
        ) : (
          <>
            {/* Subscription Cards */}
            <section className="mb-8 grid md:grid-cols-2 gap-6">
              {/* Plus Card */}
              <div
                onClick={() => setSelectedPlan('plus')}
                className={`relative rounded-xl p-0.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200 cursor-pointer ${
                  selectedPlan === 'plus'
                    ? 'bg-gradient-to-r from-blue-500 to-violet-500'
                    : 'bg-zinc-200 dark:bg-zinc-800'
                }`}
              >
                <div className="rounded-xl bg-white dark:bg-zinc-900 p-6 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("billing.plus.title")}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 dark:bg-blue-500 text-white font-medium">
                      {t("billing.mostPopular")}
                    </span>
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{t("billing.plus.description")}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {billingPeriod === 'monthly' ? '$9.99' : '$7.99'}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-1">
                      {t('billing.perMonth')}
                    </span>
                    {billingPeriod === 'annual' && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                        {t('billing.savePercent', { percent: 20 })}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plusFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <Check aria-hidden="true" size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {profile?.plan === 'plus' ? (
                    profile?.billing_state?.managed_by === 'stripe' ? (
                      <button
                        onClick={handleManage}
                        disabled={submitting !== null}
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                      >
                        {t("billing.manage")}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed font-medium"
                      >
                        {t("billing.currentPlan.title")}
                      </button>
                    )
                  ) : profile?.plan === 'pro' ? (
                    <button
                      onClick={() => handlePlanAction('plus')}
                      disabled={submitting !== null}
                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      {submitting === 'plus' ? t("common.loading") : `${t("billing.downgrade")} Plus`}
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlanAction('plus')}
                      disabled={submitting !== null}
                      className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 text-white disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      {submitting === 'plus' ? t("common.loading") : `${t("billing.upgrade")} Plus`}
                    </button>
                  )}
                </div>
              </div>

              {/* Pro Card */}
              <div
                onClick={() => setSelectedPlan('pro')}
                className={`relative rounded-xl p-0.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200 cursor-pointer ${
                  selectedPlan === 'pro'
                    ? 'bg-gradient-to-r from-blue-500 to-violet-500'
                    : 'bg-zinc-200 dark:bg-zinc-800'
                }`}
              >
                <div className="rounded-xl bg-white dark:bg-zinc-900 p-6 h-full flex flex-col">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{t("billing.pro.title")}</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{t("billing.pro.description")}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {billingPeriod === 'monthly' ? '$19.99' : '$15.99'}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-1">
                      {t('billing.perMonth')}
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
                    profile?.billing_state?.managed_by === 'stripe' ? (
                      <button
                        onClick={handleManage}
                        disabled={submitting !== null}
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                      >
                        {t("billing.manage")}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed font-medium"
                      >
                        {t("billing.currentPlan.title")}
                      </button>
                    )
                  ) : profile?.plan === 'plus' ? (
                    <button
                      onClick={() => handlePlanAction('pro')}
                      disabled={submitting !== null}
                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      {submitting === 'pro' ? t("common.loading") : `${t("billing.upgrade")} Pro`}
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlanAction('pro')}
                      disabled={submitting !== null}
                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      {submitting === 'pro' ? t("common.loading") : `${t("billing.upgrade")} Pro`}
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Pricing Comparison */}
            <section className="mb-8">
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wide">
                {t("billing.comparison.title")}
              </h2>
              <PricingTable
                currentPlan={profile?.plan as PlanType || 'free'}
                onUpgrade={handleUpgrade}
                selectedPlan={selectedPlan}
                onSelectPlan={setSelectedPlan}
                submitting={submitting}
              />
            </section>
          </>
        )}

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
              className="mt-2 text-sm underline hover:text-zinc-700 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
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
                className="border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-6 flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200"
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
                  disabled={loading !== null || submitting !== null}
                  className="mt-auto pt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  {loading === product.id ? t("common.loading") : t("billing.purchase")}
                </button>
              </div>
            ))}
          </div>
        )}

        {confirmUpgrade && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmUpgrade(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-zinc-950/40"
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t("billing.confirmUpgrade.title")}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t("billing.confirmUpgrade.description")}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                  <span>{t("billing.confirmUpgrade.immediateCharge")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                  <span>{t("billing.confirmUpgrade.bonusCredits")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                  <span>{t("billing.confirmUpgrade.effectiveNow")}</span>
                </li>
              </ul>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmUpgrade(null)}
                  disabled={submitting === "confirm-upgrade"}
                  className="px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={confirmUpgradeAction}
                  disabled={submitting === "confirm-upgrade"}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors font-medium"
                >
                  {submitting === "confirm-upgrade"
                    ? t("common.loading")
                    : t("billing.confirmUpgrade.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDowngrade && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmDowngrade(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-zinc-950/40"
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t("billing.confirmDowngrade.title")}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t("billing.confirmDowngrade.description")}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                  <span>{t("billing.confirmDowngrade.creditsKept")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                  <span>{t("billing.confirmDowngrade.effectiveNow")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                  <span>{t("billing.confirmDowngrade.nextBilling")}</span>
                </li>
              </ul>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmDowngrade(null)}
                  disabled={submitting === "confirm-downgrade"}
                  className="px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={confirmDowngradeAction}
                  disabled={submitting === "confirm-downgrade"}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors font-medium"
                >
                  {submitting === "confirm-downgrade"
                    ? t("common.loading")
                    : t("billing.confirmDowngrade.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel subscription confirmation — BGB §312k compliant copy.
            Reuses the same overlay/animation style as the other confirm modals. */}
        {confirmCancel && profile && profile.billing_state && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmCancel(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-cancel-title"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl"
            >
              <h2
                id="confirm-cancel-title"
                className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3"
              >
                {t('billing.cancel.modal.title')}
              </h2>
              <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300 mb-6">
                {profile.billing_state.managed_by === 'admin'
                  ? t('billing.cancel.modal.bodyAdmin')
                  : t('billing.cancel.modal.bodyStripe', {
                      plan:
                        profile.plan === 'plus'
                          ? t('billing.plus.title')
                          : t('billing.pro.title'),
                      date: profile.billing_state.period_end
                        ? new Date(profile.billing_state.period_end).toLocaleDateString(locale)
                        : '—',
                    })}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  disabled={submitting === 'cancel'}
                  className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  {t('billing.cancel.modal.back')}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting === 'cancel'}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400 text-white disabled:opacity-50 shadow-sm transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  {submitting === 'cancel'
                    ? t('common.loading')
                    : t('billing.cancel.modal.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BillingSuspenseFallback() {
  const { t } = useLocale();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--page-background)]">
      <div className="animate-pulse text-zinc-500">{t('common.loading')}</div>
    </div>
  );
}

export default function BillingPageClient() {
  return (
    <Suspense fallback={<BillingSuspenseFallback />}>
      <BillingContent />
    </Suspense>
  );
}
