"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminRetentionCurvePoint, AdminRetentionDauPoint } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";

export default function RetentionCurves({
  curves,
  dauSeries,
}: {
  curves: AdminRetentionCurvePoint[];
  dauSeries: AdminRetentionDauPoint[];
}) {
  const { tOr } = useLocale();
  const curveData = curves.map((point) => ({ ...point, pctValue: point.pct * 100 }));

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="dt-admin-panel rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {tOr("admin.retention.curvesTitle", "D1 / D7 / D30 Return")}
        </h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curveData} margin={{ top: 10, right: 18, bottom: 0, left: -18 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                formatter={(value, _name, item) => [
                  `${Number(value).toFixed(1)}%`,
                  item.payload?.label || tOr("admin.retention.returned", "Returned"),
                ]}
                labelFormatter={(label) => `${label}`}
              />
              <Line
                type="monotone"
                dataKey="pctValue"
                stroke="#1D4ED8"
                strokeWidth={2}
                dot={{ r: 4, fill: "#1D4ED8" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {curves.map((point) => (
            <div key={point.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{point.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                {formatPercent(point.pct)}
              </p>
              <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {tOr("admin.retention.returnedOutOf", "{returned} / {activated} returned", {
                  returned: formatNumber(point.returned_users),
                  activated: formatNumber(point.activated_users),
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="dt-admin-panel rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {tOr("admin.retention.dauTitle", "DAU Last 30 Days")}
        </h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dauSeries} margin={{ top: 10, right: 18, bottom: 0, left: -18 }}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={22} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(value) => [formatNumber(Number(value)), tOr("admin.retention.dau", "DAU")]} />
              <Line
                type="monotone"
                dataKey="dau"
                stroke="#1D4ED8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
