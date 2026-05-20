"use client";

import { useState, useEffect, useCallback, useRef, Suspense, type RefObject } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";
import Header from "../../components/Header";
import {
  cancelSubscription,
  changePlan,
  createSubscription,
  createPortalSession,
  type CancelSubscriptionReason,
} from "../../lib/api";
import { triggerCreditsRefresh } from "../../components/CreditsDisplay";
import PricingTable from "../../components/PricingTable";
import { PLAN_HIERARCHY, type PlanType } from "../../lib/models";
import { authHrefFor, type BillingPeriodIntent, type BillingPlanIntent } from "../../lib/billingLinks";
import { trackEvent } from "../../lib/analytics";
import { ArrowRight, CalendarDays, Check, Coins, CreditCard, ShieldCheck } from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useUserProfile } from "../../lib/useUserProfile";

interface Product {
  id: string;
  credits: number;
  price_usd: number;
}

const CANCEL_REASONS: Array<{ value: CancelSubscriptionReason; label: string; fallback: string }> = [
  { value: "not_a_fit", label: "billing.cancel.reason.notFit", fallback: "Not a good fit for my needs" },
  { value: "answer_quality", label: "billing.cancel.reason.answerQuality", fallback: "Answers or citations were not good enough" },
  { value: "pdf_or_parsing", label: "billing.cancel.reason.parsing", fallback: "A document failed to load or parse" },
  { value: "too_expensive", label: "billing.cancel.reason.tooExpensive", fallback: "Too expensive for my usage" },
  { value: "temporary_need", label: "billing.cancel.reason.temporary", fallback: "I only needed it temporarily" },
  { value: "missing_feature", label: "billing.cancel.reason.missingFeature", fallback: "A feature I need is missing" },
  { value: "found_alternative", label: "billing.cancel.reason.alternative", fallback: "I found another tool" },
  { value: "other", label: "billing.cancel.reason.other", fallback: "Other" },
];

/**
 * Display price for (plan, billing) combos shown in the plan cards above the fold.
 * Mirrors the inline prices on the Plus / Pro cards so the confirm dialog shows the
 * same number the user just clicked (I19). Annual prices are the monthly-equivalent
 * post-discount — `/perMonth` is the matching unit. If a future plan/billing combo
 * is added here, update the plan cards' inline literals too.
 */
const PLAN_PRICE_USD: Record<string, Record<string, string>> = {
  plus: { monthly: '$9.99', annual: '$7.99' },
  pro: { monthly: '$19.99', annual: '$15.99' },
};

// Local helper: traps Tab/Shift+Tab inside `ref`, focuses the first focusable element
// on open, and restores focus to the previously-active element on close. Scoped to this
// file because the 3 confirm dialogs share the exact same shape; not a Wave-2 refactor.
function useDialogFocusTrap(open: boolean, ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const first = ref.current?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const focusables = ref.current?.querySelectorAll<HTMLElement>(focusableSelector);
      if (!focusables || focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, ref]);
}

function BillingContent() {
  const { t, tOr, locale } = useLocale();
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
  const [cancelReason, setCancelReason] = useState<CancelSubscriptionReason | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [refundRequested, setRefundRequested] = useState(false);

  // I13 focus-trap refs for the three confirm dialogs. The hook captures the previously
  // focused element on open and restores it on close.
  const confirmUpgradeRef = useRef<HTMLDivElement>(null);
  const confirmDowngradeRef = useRef<HTMLDivElement>(null);
  const confirmCancelRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(confirmUpgrade !== null, confirmUpgradeRef);
  useDialogFocusTrap(confirmDowngrade !== null, confirmDowngradeRef);
  useDialogFocusTrap(confirmCancel, confirmCancelRef);

  useEffect(() => {
    const planParam = searchParams.get("plan");
    const periodParam = searchParams.get("period") || searchParams.get("billing");

    if (planParam === "plus" || planParam === "pro") {
      setSelectedPlan(planParam as BillingPlanIntent);
    }
    if (periodParam === "monthly" || periodParam === "annual") {
      setBillingPeriod(periodParam as BillingPeriodIntent);
    }
    if (planParam === "plus" || planParam === "pro" || searchParams.get("source") || searchParams.get("reason")) {
      trackEvent("billing_view", {
        plan: planParam || "plus",
        period: periodParam || "monthly",
        source: searchParams.get("source"),
        reason: searchParams.get("reason"),
      });
    }
  }, [searchParams]);

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
      const query = searchParams.toString();
      const returnPath = query ? `/billing?${query}` : "/billing";
      router.push(authHrefFor(returnPath));
    }
  }, [status, router, searchParams]);

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
    const source = searchParams.get("source") || "billing";
    const reason = searchParams.get("reason");
    try {
      trackEvent("upgrade_click", {
        plan,
        period: billingPeriod,
        source,
        reason,
      });
      const res = await createSubscription({ plan, billing: billingPeriod, source, reason });
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
      const reason = cancelReason || undefined;
      trackEvent('subscription_cancel_requested', {
        source: 'billing_cancel_modal',
        reason: reason || 'not_provided',
        plan: profile?.plan || 'unknown',
        refund_requested: refundRequested,
      });
      if (refundRequested) {
        trackEvent('refund_requested', {
          source: 'billing_cancel_modal',
          reason: reason || 'not_provided',
          plan: profile?.plan || 'unknown',
        });
      }
      const res = await cancelSubscription({
        reason,
        feedback: cancelFeedback.trim() || undefined,
        refund_requested: refundRequested,
      });
      const date = res.effective_at
        ? new Date(res.effective_at).toLocaleDateString(locale)
        : '';
      const baseMessage = res.status === 'scheduled_cancel'
        ? t('billing.cancel.successScheduled', { date })
        : t('billing.cancel.successImmediate');
      setMessage(
        res.refund_requested
          ? `${baseMessage} ${tOr('billing.cancel.refundRequested', 'Your refund request was recorded for review.')}`
          : baseMessage
      );
      setConfirmCancel(false);
      setCancelReason(null);
      setCancelFeedback("");
      setRefundRequested(false);
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
      <div className="dt-stitch-theme min-h-screen">
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
      <div className="dt-stitch-theme min-h-screen">
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

  const currentPlanLabel = profile
    ? profile.plan === 'pro'
      ? t('billing.pro.title')
      : profile.plan === 'plus'
        ? t('billing.plus.title')
        : t('pricing.free.name')
    : t('common.loading');

  const billingOverview = [
    {
      icon: CreditCard,
      label: tOr('billing.overview.plan', 'Current plan'),
      value: currentPlanLabel,
    },
    {
      icon: Coins,
      label: tOr('billing.overview.credits', 'Credits available'),
      value: profile ? profile.credits_balance.toLocaleString() : '...',
    },
    {
      icon: CalendarDays,
      label: tOr('billing.overview.renewal', 'Renewal'),
      value: profile?.billing_state?.period_end
        ? new Date(profile.billing_state.period_end).toLocaleDateString(locale)
        : tOr('billing.overview.noRenewal', 'No renewal'),
    },
  ];
  const hasReachedAhaMoment = Boolean(
    profile && profile.stats.total_documents > 0 && profile.stats.total_messages > 0
  );
  const showFitCheck = profile?.plan === 'free' && !profileLoading && !hasReachedAhaMoment;

  return (
    <div className="dt-stitch-theme min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <section className="mb-8 grid gap-5 lg:grid-cols-[1fr_440px] lg:items-end">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {tOr('billing.eyebrow', 'Plans and credits')}
            </p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t("billing.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
              {tOr(
                'billing.subtitle',
                'Choose the plan that matches your document volume, manage your subscription, and add credits when a project needs extra room.'
              )}
            </p>
          </div>

          <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <ShieldCheck aria-hidden="true" size={17} className="text-accent" />
              {tOr('billing.overview.title', 'Billing overview')}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {billingOverview.map(({ icon: Icon, label, value }) => (
                <div key={label} className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <Icon aria-hidden="true" size={16} className="mb-2 text-accent" />
                  <div className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {value}
                  </div>
                  <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            {message}
          </div>
        )}

        {showFitCheck && (
          <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  {tOr('billing.fitCheck.title', 'Try one cited answer before upgrading')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-800 dark:text-blue-200">
                  {tOr(
                    'billing.fitCheck.body',
                    'DocTalk works best after you test your own document, ask a real question, and click a citation back to the source.'
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50 dark:focus-visible:ring-offset-blue-950"
                >
                  {tOr('billing.fitCheck.uploadCta', 'Upload a document')}
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-white px-3.5 py-2 text-sm font-medium text-blue-900 transition-colors hover:border-blue-400 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50 dark:focus-visible:ring-offset-blue-950"
                >
                  {tOr('billing.fitCheck.demoCta', 'Use sample demo')}
                </Link>
              </div>
            </div>
          </section>
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
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {tOr('billing.planSelector.title', 'Subscription plans')}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {tOr('billing.planSelector.subtitle', 'Annual billing keeps the same monthly credit allowance and lowers the effective price.')}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              aria-pressed={billingPeriod === 'monthly'}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${
                billingPeriod === 'monthly'
                  ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-50 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-900'
              }`}
            >
              {t('billing.monthly')}
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              aria-pressed={billingPeriod === 'annual'}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${
                billingPeriod === 'annual'
                  ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-50 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-900'
              }`}
            >
              {t('billing.annual')}
            </button>
          </div>
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
                className={`relative rounded-xl border p-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                  selectedPlan === 'plus'
                    ? 'border-accent bg-white ring-1 ring-accent/20 dark:bg-zinc-900'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <div className="rounded-xl p-6 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("billing.plus.title")}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
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
                      className="w-full px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      {submitting === 'plus' ? t("common.loading") : `${t("billing.upgrade")} Plus`}
                    </button>
                  )}
                </div>
              </div>

              {/* Pro Card */}
              <div
                onClick={() => setSelectedPlan('pro')}
                className={`relative rounded-xl border p-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                  selectedPlan === 'pro'
                    ? 'border-accent bg-white ring-1 ring-accent/20 dark:bg-zinc-900'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <div className="rounded-xl p-6 h-full flex flex-col">
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
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {tOr('billing.refundPolicy.title', '7-day fair-use refund')}
                    </p>
                    <p className="mt-1 leading-6 text-emerald-800 dark:text-emerald-200">
                      {tOr(
                        'billing.refundPolicy.body',
                        'If DocTalk is not a fit and usage is low, cancel within 7 days and request a refund review from the cancel flow.'
                      )}
                    </p>
                  </div>
                  <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                </div>
              </div>
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
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  {loading === product.id ? t("common.loading") : t("billing.purchase")}
                  {loading !== product.id && <ArrowRight aria-hidden="true" size={15} />}
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
              ref={confirmUpgradeRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-upgrade-title"
              className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
            >
              <h3 id="confirm-upgrade-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t("billing.confirmUpgrade.title")}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t("billing.confirmUpgrade.description")}
              </p>
              {/* I19: surface target plan + price + period inline so users see the exact
                  charge before confirming. Reuses the same hardcoded prices shown on the
                  Plus / Pro cards above the fold (PLAN_PRICE_USD). */}
              <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                {confirmUpgrade.plan === 'pro' ? t('billing.pro.title') : t('billing.plus.title')}
                {' · '}
                {PLAN_PRICE_USD[confirmUpgrade.plan]?.[confirmUpgrade.billing] ?? ''}
                {t('billing.perMonth')}
                {' · '}
                {confirmUpgrade.billing === 'annual' ? t('billing.annual') : t('billing.monthly')}
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
              ref={confirmDowngradeRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-downgrade-title"
              className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
            >
              <h3 id="confirm-downgrade-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t("billing.confirmDowngrade.title")}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t("billing.confirmDowngrade.description")}
              </p>
              {/* I19: surface target plan + price + period inline (mirrors the upgrade
                  dialog). On downgrade Stripe applies the change at the next billing
                  period boundary, but showing the future per-month rate still helps the
                  user reconcile what they're about to pay going forward. */}
              <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                {confirmDowngrade.plan === 'pro' ? t('billing.pro.title') : t('billing.plus.title')}
                {' · '}
                {PLAN_PRICE_USD[confirmDowngrade.plan]?.[confirmDowngrade.billing] ?? ''}
                {t('billing.perMonth')}
                {' · '}
                {confirmDowngrade.billing === 'annual' ? t('billing.annual') : t('billing.monthly')}
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
          >
            <div
              ref={confirmCancelRef}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-cancel-title"
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

              <div className="mb-5 space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {tOr('billing.cancel.reasonPrompt', 'What made you decide to cancel?')}
                  </p>
                  <div className="grid gap-2" role="radiogroup" aria-label={tOr('billing.cancel.reasonPrompt', 'What made you decide to cancel?')}>
                    {CANCEL_REASONS.map((reason) => {
                      const selected = cancelReason === reason.value;
                      return (
                        <button
                          key={reason.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setCancelReason(reason.value)}
                          disabled={submitting === 'cancel'}
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${
                            selected
                              ? 'border-zinc-900 bg-zinc-100 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100'
                              : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
                          }`}
                        >
                          {tOr(reason.label, reason.fallback)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="cancel-feedback" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {tOr('billing.cancel.feedbackLabel', 'Anything we should understand?')}
                  </label>
                  <textarea
                    id="cancel-feedback"
                    value={cancelFeedback}
                    onChange={(event) => setCancelFeedback(event.target.value)}
                    disabled={submitting === 'cancel'}
                    maxLength={1000}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:ring-zinc-500"
                    placeholder={tOr('billing.cancel.feedbackPlaceholder', 'Optional. One sentence is enough.')}
                  />
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <input
                    type="checkbox"
                    checked={refundRequested}
                    onChange={(event) => setRefundRequested(event.target.checked)}
                    disabled={submitting === 'cancel'}
                    className="mt-1 rounded border-emerald-300 text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400"
                  />
                  <span>
                    <span className="block font-medium">
                      {tOr('billing.cancel.refundCheckbox', 'Request a refund review')}
                    </span>
                    <span className="mt-0.5 block leading-5 text-emerald-800 dark:text-emerald-200">
                      {tOr('billing.cancel.refundHint', 'Best for recent purchases with low usage. Cancellation is not blocked by this choice.')}
                    </span>
                  </span>
                </label>
              </div>

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
    <div className="dt-stitch-theme min-h-screen flex items-center justify-center">
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
