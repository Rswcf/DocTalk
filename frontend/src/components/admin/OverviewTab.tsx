"use client";

import {
  Activity,
  AlertCircle,
  BadgeDollarSign,
  CalendarPlus,
  DatabaseBackup,
  Gauge,
  RadioTower,
} from "lucide-react";
import type { AdminBackupStatus, AdminOpsHealth, AdminUserActivity } from "../../lib/api";
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
  opsHealth,
  opsHealthFailed = false,
  onRetryOpsHealth,
}: {
  overview: Overview | null;
  activity: AdminUserActivity | null;
  trends: Trends | null;
  opsHealth?: AdminOpsHealth | null;
  opsHealthFailed?: boolean;
  onRetryOpsHealth?: () => void;
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
      {opsHealth ? (
        <BackupStatusPanel backup={opsHealth.postgres_backup} />
      ) : opsHealthFailed ? (
        <BackupStatusPanel backup={null} onRetry={onRetryOpsHealth} />
      ) : null}
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

const BACKUP_STATE_TONE: Record<AdminBackupStatus["status"], "ok" | "warn" | "muted"> = {
  ok: "ok",
  disabled: "muted",
  stale: "warn",
  small: "warn",
  unverified: "warn",
  missing: "warn",
  unreachable: "warn",
};

function BackupStatusPanel({ backup, onRetry }: { backup: AdminBackupStatus | null; onRetry?: () => void }) {
  const { tOr } = useLocale();
  if (!backup) {
    return (
      <section className="dt-admin-panel rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <DatabaseBackup size={16} aria-hidden="true" />
            {tOr("admin.backups.title", "Postgres backups")}
          </h2>
          <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {tOr("admin.backups.unavailable", "Check unavailable")}
          </span>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
          >
            {tOr("common.retry", "Retry")}
          </button>
        ) : null}
      </section>
    );
  }
  const tone = BACKUP_STATE_TONE[backup.status] ?? "warn";
  const label = {
    ok: tOr("admin.backups.status.ok", "Healthy"),
    stale: tOr("admin.backups.status.stale", "Stale"),
    small: tOr("admin.backups.status.small", "Too small"),
    unverified: tOr("admin.backups.status.unverified", "Unverified"),
    missing: tOr("admin.backups.status.missing", "Missing"),
    unreachable: tOr("admin.backups.status.unreachable", "Storage unreachable"),
    disabled: tOr("admin.backups.status.disabled", "Monitor off"),
  }[backup.status] ?? backup.status;
  const pillClass = tone === "ok"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : tone === "muted"
      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  const details: string[] = [];
  if (backup.age_hours != null) {
    details.push(tOr("admin.backups.age", "{hours} h ago", { hours: String(backup.age_hours) }));
  }
  if (backup.bytes != null) details.push(`${(backup.bytes / 1_000_000).toFixed(1)} MB`);
  if (backup.restore_test) {
    details.push(backup.restore_test === "ok"
      ? tOr("admin.backups.restoreOk", "restore test passed")
      : tOr("admin.backups.restoreNotOk", "restore test not passed"));
  }

  return (
    <section className="dt-admin-panel rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          <DatabaseBackup size={16} aria-hidden="true" />
          {tOr("admin.backups.title", "Postgres backups")}
        </h2>
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${pillClass}`}>{label}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {details.length > 0 ? details.join(" · ") : tOr("admin.backups.none", "No backup found")}
      </p>
    </section>
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
