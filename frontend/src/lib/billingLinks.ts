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
