"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import type {
  AdminMetricDelta,
  AdminPaidIntentReasonItem,
  AdminUserActivity,
  AdminUserActivityFunnelStage,
  AdminUserActivitySegmentItem,
} from "../lib/api";
import { useLocale } from "../i18n";

interface AdminUserActivityChartsProps {
  activity: AdminUserActivity;
}

const CHART_COLORS = {
  active: "#38bdf8",
  upload: "#22c55e",
  chat: "#60a5fa",
  feedback: "#f59e0b",
  nudge: "#facc15",
  paywall: "#a78bfa",
  limit: "#fb7185",
  checkout: "#34d399",
  neutral: "#94a3b8",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatPercent(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function DeltaBadge({ delta }: { delta?: AdminMetricDelta }) {
  if (!delta || delta.delta_percent == null) {
    return <span className="text-xs text-zinc-400">No prior window</span>;
  }
  const positive = delta.delta >= 0;
  return (
    <span className={positive ? "text-xs text-emerald-600 dark:text-emerald-300" : "text-xs text-red-600 dark:text-red-300"}>
      {positive ? "+" : ""}
      {delta.delta_percent.toFixed(1)}% vs prior
    </span>
  );
}

function MetricTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: number | string;
  delta?: AdminMetricDelta;
}) {
  return (
    <div className="dt-kpi-card rounded-2xl p-4">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <div className="mt-1">
        <DeltaBadge delta={delta} />
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="dt-admin-panel overflow-hidden border">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ label = "No data" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center text-sm text-zinc-400">
      {label}
    </div>
  );
}

function FunnelList({ stages }: { stages: AdminUserActivityFunnelStage[] }) {
  if (stages.length === 0) return <EmptyState />;
  const maxUsers = Math.max(...stages.map((stage) => stage.users), 1);
  return (
    <div className="space-y-2">
      {stages.map((stage) => (
        <div key={stage.key} className="grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-3 text-xs">
          <div className="truncate text-zinc-600 dark:text-zinc-300" title={stage.label}>
            {stage.label}
          </div>
          <div className="h-7 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
            <div
              className="flex h-full items-center justify-end rounded bg-accent px-2 text-[11px] font-medium text-white"
              style={{ width: `${Math.max((stage.users / maxUsers) * 100, stage.users > 0 ? 4 : 0)}%` }}
            >
              {stage.users > 0 ? formatPercent(stage.rate_from_signup) : ""}
            </div>
          </div>
          <div className="w-16 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatNumber(stage.users)}
          </div>
        </div>
      ))}
    </div>
  );
}

function RetentionTable({ activity }: { activity: AdminUserActivity }) {
  if (activity.retention.length === 0) {
    return <EmptyState label={activity.retention_explanation || "No signup cohorts yet"} />;
  }
  const columns: { key: "d0_rate" | "d1_rate" | "d7_rate" | "d30_rate"; label: string }[] = [
    { key: "d0_rate", label: "D0" },
    { key: "d1_rate", label: "D1" },
    { key: "d7_rate", label: "D7" },
    { key: "d30_rate", label: "D30" },
  ];
  return (
    <div>
      {activity.retention_explanation && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {activity.retention_explanation}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-3 font-medium">Cohort</th>
              <th className="px-3 py-2 text-right font-medium">Users</th>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 text-right font-medium">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {activity.retention.slice(0, 14).map((row) => (
              <tr key={row.cohort_date}>
                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{row.cohort_date}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                  {formatNumber(row.cohort_size)}
                </td>
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td key={column.key} className="px-3 py-2 text-right">
                      <span
                        className="inline-flex min-w-12 justify-end rounded px-2 py-1 tabular-nums text-zinc-900 dark:text-zinc-50"
                        style={{ backgroundColor: `rgba(29, 78, 216, ${Math.min(0.12 + value * 0.9, 0.75)})` }}
                      >
                        {formatPercent(value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SegmentBars({ items }: { items: AdminUserActivitySegmentItem[] }) {
  if (items.length === 0) return <EmptyState />;
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => (
        <div key={item.key} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-xs">
          <span className="truncate text-zinc-600 dark:text-zinc-300" title={item.key}>{item.key}</span>
          <div className="h-2 rounded bg-zinc-100 dark:bg-zinc-900">
            <div className="h-full rounded bg-zinc-500" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="text-right tabular-nums text-zinc-700 dark:text-zinc-300">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function PaidIntentTable({ rows }: { rows: AdminPaidIntentReasonItem[] }) {
  if (rows.length === 0) return <EmptyState label="No paid-intent events yet" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.slice(0, 10).map((row, index) => (
            <tr key={`${row.event_name}-${row.reason}-${row.source}-${row.plan}-${index}`}>
              <td className="py-2 pr-3">
                <p className="font-medium text-zinc-800 dark:text-zinc-100">{row.label || "Paid signal"}</p>
                <p className="mt-0.5 max-w-lg text-zinc-500 dark:text-zinc-400">{row.description || "No context recorded."}</p>
              </td>
              <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{row.plan ? row.plan.toUpperCase() : "-"}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {row.users} users / {row.events} events
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminUserActivityCharts({ activity }: AdminUserActivityChartsProps) {
  const { tOr } = useLocale();
  const summary = activity.summary;
  const series = activity.series;
  const paidIntentSeries = series.map((point) => ({
    ...point,
    checkout_total: point.checkout_created + point.checkout_completed,
  }));

  return (
    <div className="mb-8 space-y-6">
      <div className="dt-glass-panel flex flex-col gap-1 rounded-2xl px-4 py-3">
        <h2 className="text-lg font-semibold text-[var(--workbench-ink)]">{tOr('admin.activityIntelligence', 'User Activity Intelligence')}</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Last {activity.days} days · generated {new Date(activity.generated_at).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricTile label="DAU" value={summary.dau} />
        <MetricTile label="WAU" value={summary.wau} />
        <MetricTile label="MAU" value={summary.mau} />
        <MetricTile label="Signups" value={summary.signups} delta={summary.deltas.signups} />
        <MetricTile label="Upload users" value={summary.upload_users} delta={summary.deltas.upload_users} />
        <MetricTile label="Chat users" value={summary.chat_users} delta={summary.deltas.chat_users} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Section title="Active User Trend" subtitle="Composite active users include uploads, user messages, AI usage, product events, and feedback.">
          <div className="h-72">
            {series.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="activity-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.active} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_COLORS.active} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="activity-upload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.upload} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.upload} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} className="text-zinc-500" />
                  <YAxis tickFormatter={formatNumber} tick={{ fontSize: 11 }} width={46} className="text-zinc-500" />
                  <Tooltip
                    formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name)]}
                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                    contentStyle={{
                      background: "var(--background, #fff)",
                      border: "1px solid var(--border, #e4e4e7)",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Area type="monotone" dataKey="active_users" name="active_users" stroke={CHART_COLORS.active} fill="url(#activity-active)" strokeWidth={2} />
                  <Area type="monotone" dataKey="upload_users" name="upload_users" stroke={CHART_COLORS.upload} fill="url(#activity-upload)" strokeWidth={2} />
                  <Area type="monotone" dataKey="chat_users" name="chat_users" stroke={CHART_COLORS.chat} fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section title="Signup Cohort Funnel" subtitle={`${activity.days} day signup cohort, unique users by stage.`}>
          <FunnelList stages={activity.funnel} />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Paid Intent Signals" subtitle="Events that reveal interest or friction before payment.">
          <div className="h-64">
            {paidIntentSeries.length === 0 ? (
              <EmptyState label="No paid-intent events yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paidIntentSeries} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} className="text-zinc-500" />
                  <YAxis tickFormatter={formatNumber} tick={{ fontSize: 11 }} width={46} className="text-zinc-500" />
                  <Tooltip
                    formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name).replaceAll("_", " ")]}
                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                    contentStyle={{
                      background: "var(--background, #fff)",
                      border: "1px solid var(--border, #e4e4e7)",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Bar dataKey="upgrade_nudge_shown" name="Upgrade reminder shown" stackId="paid" fill={CHART_COLORS.nudge} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="paywall_opened" name="Blocking paywall shown" stackId="paid" fill={CHART_COLORS.paywall} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="limit_hit" name="User hit a plan limit" stackId="paid" fill={CHART_COLORS.limit} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="upgrade_click" name="Upgrade clicked" stackId="paid" fill={CHART_COLORS.neutral} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="checkout_total" name="Checkout started or completed" stackId="paid" fill={CHART_COLORS.checkout} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section title="Retention" subtitle="Signup cohorts with same-day, D1, D7, and D30 return activity.">
          <RetentionTable activity={activity} />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section title="Conversion Blockers" subtitle="Blocking paywalls, plan limits, and refund signals ranked by event count. Non-blocking upgrade reminders are excluded.">
          <PaidIntentTable rows={activity.segments.conversion_blockers} />
        </Section>

        <Section title="Feedback Mix" subtitle={`${formatNumber(activity.feedback.total)} submissions in this window.`}>
          <div className="grid gap-4">
            <SegmentBars items={activity.feedback.by_type} />
            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <SegmentBars items={activity.feedback.by_area} />
            </div>
          </div>
        </Section>

        <Section title="Recent Feedback" subtitle="Latest submitted user requests and defects.">
          {activity.feedback.recent.length === 0 ? (
            <EmptyState label="No feedback yet" />
          ) : (
            <div className="space-y-3">
              {activity.feedback.recent.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-md border border-zinc-100 p-3 text-xs dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{item.type} · {item.area}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-zinc-600 dark:text-zinc-400">
                    {item.message_preview || "No written detail"}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                    <span className="truncate">{item.path || "-"}</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
