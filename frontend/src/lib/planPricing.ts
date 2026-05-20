/**
 * Canonical price source for the Plus / Pro subscription plans.
 *
 * Wave-2 Q31 (2026-05-20): consolidated from inline literals previously
 * scattered through `frontend/src/app/billing/BillingPageClient.tsx`
 * (`PLAN_PRICE_USD` + two inline `'$9.99' : '$7.99'` ternaries on the plan
 * cards). The billing page now imports from this module instead of carrying
 * its own copy.
 *
 * Single source of truth for STRUCTURED price access (plan + period -> dollar
 * string used in confirm dialogs and plan-card numerals).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *   IMPORTANT: SYNCHRONIZATION REQUIREMENT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * When you change a price here, you MUST also update the matching i18n
 * marketing copy in every locale (the marketing pricing page renders its
 * numbers through i18n keys, not this module — keys for "Plus monthly",
 * "Pro monthly", etc. are hand-written per-language). Mismatches between
 * the marketing page and the billing page are a launch blocker.
 *
 * Keys to keep in sync (`frontend/src/i18n/locales/{en,zh,ja,ko,es,de,fr,
 * pt,it,ar,hi}.json`):
 *
 *   pricing.plus.price           — primary plan-card numeral on /pricing
 *   pricing.pro.price            — primary plan-card numeral on /pricing
 *   billing.plus.priceMonthly    — annotated forms shown elsewhere
 *   billing.plus.priceAnnual       (annual-equivalent monthly rate, billed
 *   billing.pro.priceMonthly       annually with the standard discount)
 *   billing.pro.priceAnnual
 *
 * Also remember: the annual price is the per-month-equivalent shown when
 * `billing.savePercent` is rendered alongside it. Multiply by 12 to get the
 * actual annual charge.
 *
 * If you ever add a new plan/period combo, update both this file AND every
 * locale JSON in the same PR.
 */

export type PlanId = 'plus' | 'pro';
export type BillingPeriod = 'monthly' | 'annual';

/**
 * Display price (formatted string with currency prefix) for each plan/period
 * combo. Annual is the monthly-equivalent post-discount; `/perMonth` is the
 * matching unit in the UI.
 */
export const PLAN_PRICE_USD: Record<PlanId, Record<BillingPeriod, string>> = {
  plus: { monthly: '$9.99', annual: '$7.99' },
  pro: { monthly: '$19.99', annual: '$15.99' },
};

/**
 * Returns the dollar-formatted display price for a plan/period combo, e.g.
 * `'$9.99'`. Safe to call with any (plan, period) tuple — returns an empty
 * string for unknown combinations rather than throwing. Accepts loose
 * `string` inputs so callers holding `confirmUpgrade.plan: string` (or
 * similar) can pass through without casting.
 */
export function formatPlanPrice(plan: string, period: string): string {
  const planTable = PLAN_PRICE_USD[plan as PlanId];
  return planTable?.[period as BillingPeriod] ?? '';
}
