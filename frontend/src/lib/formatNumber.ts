/**
 * Shared number/percent formatters used across the admin dashboard
 * (AdminPageClient, AdminCharts, AdminUserActivityCharts).
 *
 * `formatNumber` — compact short-form (K/M) for chart axes and KPI tiles.
 * `formatPercent` — defensive against null/undefined; adaptive precision
 *   so small rates (0 < n < 0.1) render with one decimal place by default,
 *   and an explicit `places` override is available when the caller wants
 *   a fixed precision.
 */

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatPercent(
  n: number | null | undefined,
  places?: number,
): string {
  if (n == null) return "-";
  const decimals = places ?? (n > 0 && n < 0.1 ? 1 : 0);
  return `${(n * 100).toFixed(decimals)}%`;
}
