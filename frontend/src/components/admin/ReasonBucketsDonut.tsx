"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { AdminChurnSignalItem } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";

const COLORS = ["#1D4ED8", "#0F766E", "#52525B", "#DC2626", "#9333EA", "#2563EB"];

export default function ReasonBucketsDonut({ buckets }: { buckets: AdminChurnSignalItem[] }) {
  const { tOr } = useLocale();
  const data = buckets.filter((bucket) => bucket.count > 0);

  return (
    <section className="dt-admin-panel rounded-lg border p-4">
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {tOr("admin.churn.reasonBucketsTitle", "Reason Buckets")}
      </h2>
      {data.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {tOr("admin.churn.noBuckets", "No churn reason buckets yet.")}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={2}>
                  {data.map((bucket, index) => (
                    <Cell key={bucket.key} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatNumber(Number(value)), tOr("admin.churn.usersLabel", "Users")]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {buckets.map((bucket, index) => (
              <div key={bucket.key} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{bucket.label}</span>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
                  {formatNumber(bucket.count)} / {formatPercent(bucket.pct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
