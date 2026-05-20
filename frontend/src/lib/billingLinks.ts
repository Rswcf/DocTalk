export type BillingPlanIntent = 'plus' | 'pro';
export type BillingPeriodIntent = 'monthly' | 'annual';

interface BillingHrefOptions {
  plan?: BillingPlanIntent;
  period?: BillingPeriodIntent;
  source?: string;
  reason?: string;
}

export function billingHref({
  plan = 'plus',
  period = 'monthly',
  source,
  reason,
}: BillingHrefOptions = {}): string {
  const params = new URLSearchParams({ plan, period });
  if (source) params.set('source', source);
  if (reason) params.set('reason', reason);
  return `/billing?${params.toString()}`;
}

export function authHrefFor(path: string): string {
  return `/auth?callbackUrl=${encodeURIComponent(path)}`;
}

/**
 * Derive the upgrade-target plan to report to the user (and in analytics),
 * given the user's current billing tier and the paywall reason code. Mirrors
 * the disambiguation implicit in PaywallModal's copy:
 *   - Pro-cap reasons (PRO_MODE_LIMIT_REACHED / BALANCED_MODE_LIMIT_REACHED /
 *     MODE_NOT_ALLOWED): Free user upgrades to Plus (Plus = unrestricted Pro),
 *     Plus user upgrades to Pro.
 *   - INSUFFICIENT_CREDITS / generic 402: Free → Plus, Plus → Pro,
 *     Pro → 'pro' (already on top plan; the funnel still rolls up under the
 *     existing plan rather than getting falsely attributed to a Plus upgrade).
 *
 * Shared by `useChatStream.ts` (analytics + paywall trigger) and
 * `PaywallModal.tsx` (CTA href + click analytics) so the route the user is
 * sent to matches the funnel event they generated. Keep them in sync.
 */
export function deriveUpgradePlan(
  currentPlan: string | undefined,
  reason: string | null | undefined,
): BillingPlanIntent {
  const isProCap = reason === 'PRO_MODE_LIMIT_REACHED'
    || reason === 'BALANCED_MODE_LIMIT_REACHED'
    || reason === 'MODE_NOT_ALLOWED';
  if (isProCap) {
    return currentPlan === 'plus' ? 'pro' : 'plus';
  }
  // Credit-exhaustion path.
  if (currentPlan === 'plus' || currentPlan === 'pro') {
    return 'pro';
  }
  return 'plus';
}
