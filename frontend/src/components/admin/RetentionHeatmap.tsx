"use client";

import type { AdminRetentionCohort } from "../../lib/api";
import { formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";

function cellColor(pct: number): string {
  if (pct <= 0) return "rgba(113, 113, 122, 0.16)";
  const alpha = Math.min(0.92, 0.16 + pct * 0.76);
  return `rgba(29, 78, 216, ${alpha})`;
}

export default function RetentionHeatmap({ cohorts }: { cohorts: AdminRetentionCohort[] }) {
  const { tOr } = useLocale();
  const offsets = Array.from({ length: 12 }, (_, index) => index);

  if (cohorts.length === 0) {
    return (
      <div className="dt-admin-panel rounded-lg border p-6 text-sm text-zinc-500 dark:text-zinc-400">
        {tOr("admin.retention.emptyHeatmap", "No retention cohorts yet.")}
      </div>
    );
  }

  return (
    <section className="dt-admin-panel overflow-hidden rounded-lg border">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {tOr("admin.retention.heatmapTitle", "Weekly Cohort Retention")}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {tOr("admin.retention.heatmapSubtitle", "Signup-week cohorts by active user-message week.")}
        </p>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="text-zinc-500 dark:text-zinc-400">
              <th scope="col" className="w-28 px-2 py-1 text-left font-medium">
                {tOr("admin.retention.cohort", "Cohort")}
              </th>
              <th scope="col" className="w-16 px-2 py-1 text-right font-medium">
                {tOr("admin.retention.users", "Users")}
              </th>
              {offsets.map((offset) => (
                <th key={offset} scope="col" className="px-2 py-1 text-center font-medium tabular-nums">
                  W{offset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.cohort_week}>
                <th scope="row" className="rounded bg-zinc-50 px-2 py-2 text-left font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {cohort.cohort_week}
                </th>
                <td className="rounded bg-zinc-50 px-2 py-2 text-right tabular-nums text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {cohort.cohort_size}
                </td>
                {cohort.retention.map((cell) => {
                  const active = cell.pct >= 0.35;
                  return (
                    <td
                      key={cell.week_offset}
                      className={`h-9 min-w-12 rounded text-center align-middle font-medium tabular-nums ${
                        active ? "text-white" : "text-zinc-700 dark:text-zinc-200"
                      }`}
                      style={{ backgroundColor: cellColor(cell.pct) }}
                      title={`${cell.active_users} / ${cohort.cohort_size}`}
                    >
                      {formatPercent(cell.pct)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
