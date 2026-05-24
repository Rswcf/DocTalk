"use client";

import {
  Activity,
  AlertCircle,
  BadgeDollarSign,
  CalendarPlus,
  Gauge,
  RadioTower,
} from "lucide-react";
import type { AdminUserActivity } from "../../lib/api";
import { formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";
import KPICard from "./KPICard";
import type { Overview, Trends } from "./types";

function seriesValues(points: { count?: number; total_tokens?: number; amount?: number }[] | undefined): number[] {
  return (points || []).map((point) => point.count ?? point.total_tokens ?? point.amount ?? 0);
}

export default function OverviewTab({
  overview,
  activity,
  trends,
}: {
  overview: Overview | null;
  activity: AdminUserActivity | null;
  trends: Trends | null;
}) {
  const { tOr } = useLocale();
  if (!overview || !activity) return null;

  const summary = activity.summary;
  const activationRate = summary.signups > 0 ? summary.activated_users / summary.signups : 0;
  const stickiness = summary.mau > 0 ? summary.dau / summary.mau : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard
          icon={CalendarPlus}
          label={tOr("admin.kpi.signups", "Signups")}
          value={summary.signups}
          deltaPercent={summary.deltas.signups?.delta_percent}
          sparkline={seriesValues(trends?.signups)}
        />
        <KPICard
          icon={RadioTower}
          label={tOr("admin.kpi.wau", "WAU")}
          value={summary.wau}
          deltaPercent={summary.deltas.active_users?.delta_percent}
          sparkline={seriesValues(trends?.active_users)}
        />
        <KPICard
          icon={Activity}
          label={tOr("admin.kpi.mau", "MAU")}
          value={summary.mau}
          sparkline={seriesValues(trends?.active_users)}
        />
        <KPICard
          icon={Gauge}
          label={tOr("admin.kpi.stickiness", "Stickiness DAU/MAU")}
          value={formatPercent(stickiness)}
          deltaPercent={null}
          sparkline={activity.series.map((point) => point.active_users)}
        />
        <KPICard
          icon={BadgeDollarSign}
          label={tOr("admin.kpi.activationRate", "Activation")}
          value={formatPercent(activationRate)}
          deltaPercent={summary.deltas.chat_users?.delta_percent}
          sparkline={activity.series.map((point) => point.chat_users)}
        />
        <KPICard
          icon={BadgeDollarSign}
          label={tOr("admin.kpi.paidConversion", "Paid conversion")}
          value={formatPercent(summary.free_to_paid_rate)}
          deltaPercent={summary.deltas.checkout_completed?.delta_percent}
          sparkline={activity.series.map((point) => point.checkout_completed)}
        />
        <KPICard
          icon={AlertCircle}
          label={tOr("admin.kpi.asstZeroRate", "Asst=0 rate")}
          value="0.0%"
          deltaPercent={0}
          sparkline={activity.series.map(() => 0)}
        />
      </div>
      <section className="dt-admin-panel rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {tOr("admin.overview.accountBase", "Account Base")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniMetric label={tOr("admin.kpi.totalUsers", "Total Users")} value={overview.total_users} />
          <MiniMetric label={tOr("admin.kpi.paidUsers", "Paid Users")} value={overview.paid_users} />
          <MiniMetric label={tOr("admin.kpi.documents", "Documents")} value={overview.total_documents} />
          <MiniMetric label={tOr("admin.kpi.messages", "Messages")} value={overview.total_messages} />
        </div>
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value.toLocaleString()}</p>
    </div>
  );
}
