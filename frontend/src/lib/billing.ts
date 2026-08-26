import { createSubscription } from './api';
import { trackEvent } from './analytics';
import { billingHref, type BillingPeriodIntent, type BillingPlanIntent } from './billingLinks';

export interface StartCheckoutOptions {
  plan: BillingPlanIntent;
  billing?: BillingPeriodIntent;
  source: string;
  reason?: string | null;
}

export interface StartPlanAwareBillingActionOptions extends StartCheckoutOptions {
  /** The profile API's current plan. Undefined means it is not authoritative yet. */
  currentPlan: string | undefined;
}

export type PlanAwareBillingDecision =
  | { kind: 'checkout' }
  | { kind: 'billing'; href: string };

/**
 * Keep subscription creation exclusive to known Free users. Existing paid
 * subscribers must use the billing page's confirmed change-plan flow, and a
 * Pro user who needs more credits should land on one-time credit packs.
 */
export function decidePlanAwareBillingAction({
  plan,
  billing = 'monthly',
  source,
  reason = null,
  currentPlan,
}: StartPlanAwareBillingActionOptions): PlanAwareBillingDecision {
  if (currentPlan === 'free') {
    return { kind: 'checkout' };
  }

  const href = billingHref({ plan, period: billing, source, reason: reason || undefined });
  const needsCreditPack = currentPlan === 'pro'
    && (reason === 'credits' || reason === 'insufficient_credits');
  return { kind: 'billing', href: needsCreditPack ? `${href}#credit-packs` : href };
}

/**
 * Turn an authenticated upgrade-intent click into a Stripe Checkout redirect.
 *
 * Keep `upgrade_click` immediately before `createSubscription`: production
 * funnel analysis relies on there being no conditional gate between those two
 * operations. Failures are rethrown so the invoking UI can render them.
 */
export async function startCheckout({
  plan,
  billing = 'monthly',
  source,
  reason = null,
}: StartCheckoutOptions): Promise<void> {
  const eventProperties = { plan, period: billing, source, reason };

  try {
    trackEvent('upgrade_click', eventProperties);
    const response = await createSubscription({ plan, billing, source, reason });
    window.location.href = response.checkout_url;
  } catch (error) {
    trackEvent('checkout_failed', eventProperties);
    throw error;
  }
}

/** Execute the shared plan-aware decision for authenticated direct CTAs. */
export async function startPlanAwareBillingAction(
  options: StartPlanAwareBillingActionOptions,
): Promise<void> {
  const decision = decidePlanAwareBillingAction(options);
  if (decision.kind === 'checkout') {
    await startCheckout(options);
    return;
  }

  trackEvent('upgrade_click', {
    plan: options.plan,
    period: options.billing || 'monthly',
    source: options.source,
    reason: options.reason || null,
  });
  window.location.href = decision.href;
}

/** Extract the backend's actionable billing detail, with a localized fallback. */
export function getBillingErrorMessage(
  error: unknown,
  fallbackMessage: string,
  intervalMismatchMessage = fallbackMessage,
): string {
  if (error && typeof error === 'object') {
    const maybeApi = error as { detail?: unknown };
    if (maybeApi.detail && typeof maybeApi.detail === 'object') {
      const detail = maybeApi.detail as Record<string, unknown>;
      if (typeof detail.message === 'string' && detail.message.length > 0) {
        if (detail.message.includes('Cannot switch billing interval during beta')) {
          return intervalMismatchMessage;
        }
        return detail.message;
      }
      if (typeof detail.error === 'string') return detail.error;
    }
  }

  const raw = error instanceof Error ? error.message : String(error || '');
  if (raw.includes('Cannot switch billing interval during beta')) {
    return intervalMismatchMessage;
  }
  const detailMatch = raw.match(/"detail"\s*:\s*"([^"]+)"/);
  return detailMatch?.[1] || fallbackMessage;
}
