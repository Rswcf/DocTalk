"use client";

import type { AdminRetention, AdminRetentionSegmentItem } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";
import RetentionCurves from "./RetentionCurves";
import RetentionHeatmap from "./RetentionHeatmap";

export default function RetentionTab({ retention }: { retention: AdminRetention | null }) {
  const { tOr } = useLocale();
  if (!retention) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniMetric label={tOr("admin.retention.wau", "WAU")} value={retention.dau_wau_mau.wau} />
        <MiniMetric label={tOr("admin.retention.mau", "MAU")} value={retention.dau_wau_mau.mau} />
        <MiniMetric label={tOr("admin.retention.stickiness", "Stickiness")} value={formatPercent(retention.dau_wau_mau.stickiness)} />
      </div>
      <RetentionHeatmap cohorts={retention.cohort_grid} />
      <RetentionCurves curves={retention.curves} dauSeries={retention.dau_wau_mau.series} />
      <div className="grid gap-4 lg:grid-cols-3">
        <SegmentPanel title={tOr("admin.retention.byPlan", "Retention by Plan")} rows={retention.by_segment.plan} />
        <SegmentPanel title={tOr("admin.retention.byDocSize", "Retention by Doc Size")} rows={retention.by_segment.doc_size} />
        <SegmentPanel title={tOr("admin.retention.byLocale", "Retention by Locale")} rows={retention.by_segment.locale} />
      </div>
      <section className="dt-admin-panel rounded-lg border">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {tOr("admin.retention.weeklyFlow", "Weekly Flow")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">{tOr("admin.retention.week", "Week")}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.new", "New")}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.retained", "Retained")}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.resurrected", "Resurrected")}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.churned", "Churned")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {retention.weekly_flow.map((row) => (
                <tr key={row.week}>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{row.week}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.new)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.retained)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.resurrected)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.churned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="dt-admin-panel rounded-lg border p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}

function SegmentPanel({ title, rows }: { title: string; rows: AdminRetentionSegmentItem[] }) {
  return (
    <section className="dt-admin-panel rounded-lg border p-4">
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-zinc-700 dark:text-zinc-300">{row.label}</span>
              <span className="tabular-nums text-zinc-950 dark:text-zinc-50">{formatPercent(row.pct)}</span>
            </div>
            <div className="mt-2 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded bg-[#1D4ED8]" style={{ width: `${Math.min(100, row.pct * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {formatNumber(row.retained_users)} / {formatNumber(row.users)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
