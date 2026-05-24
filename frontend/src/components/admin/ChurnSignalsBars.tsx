"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminChurnSignalItem } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";

export default function ChurnSignalsBars({ signals }: { signals: AdminChurnSignalItem[] }) {
  const { tOr } = useLocale();
  const data = signals.map((signal) => ({
    ...signal,
    pctValue: signal.pct * 100,
    shortLabel: signal.label.replace("Assistant ", "Asst ").replace("Retrieval or ", ""),
  }));

  return (
    <section className="dt-admin-panel rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {tOr("admin.churn.signalsTitle", "Churn Signal Prevalence")}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {tOr("admin.churn.signalsSubtitle", "Share of churned users who experienced each failure signal before leaving.")}
          </p>
        </div>
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
            <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} interval={0} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
            <Tooltip
              formatter={(value, _name, item) => [
                `${Number(value).toFixed(1)}%`,
                item.payload?.label || tOr("admin.churn.signal", "Signal"),
              ]}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="pctValue" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {signals.map((signal) => (
          <div key={signal.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{signal.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
              {formatPercent(signal.pct)}
            </p>
            <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {tOr("admin.churn.users", "{n} users", { n: formatNumber(signal.count) })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
