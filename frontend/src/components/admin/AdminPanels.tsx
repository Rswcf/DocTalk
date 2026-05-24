"use client";

import {
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type {
  AdminBillingHealth,
  AdminFunnel,
  AdminRagQuality,
} from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";

export interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  credits_balance: number;
  created_at: string | null;
  doc_count: number;
  message_count: number;
}

export interface TopUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  total_tokens: number;
  total_credits: number;
  doc_count: number;
}

export function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    plus: "bg-blue-50 text-[#1D4ED8] dark:bg-blue-400/10 dark:text-blue-300",
    pro: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[plan] || colors.free}`}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
      ok
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    }`}>
      {label}
    </span>
  );
}

export function BillingHealthPanel({
  health,
  loadingRemote,
  onRemoteCheck,
}: {
  health: AdminBillingHealth | null;
  loadingRemote: boolean;
  onRemoteCheck: () => void;
}) {
  const { tOr } = useLocale();
  if (!health) return null;
  const liveReady = health.stripe_secret_mode === "live"
    && health.stripe_webhook_configured
    && health.all_subscription_prices_configured
    && !health.has_mode_mismatch;

  return (
    <section className="dt-admin-panel overflow-hidden rounded-lg border">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {liveReady ? (
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          )}
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {tOr("admin.billingHealth.title", "Billing Health")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onRemoteCheck}
          disabled={loadingRemote}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loadingRemote ? "animate-spin" : ""}`} />
          {tOr("admin.billingHealth.verifyStripe", "Verify Stripe")}
        </button>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{tOr("admin.billingHealth.secretMode", "Secret Mode")}</p>
            <StatusPill ok={health.stripe_secret_mode === "live"} label={health.stripe_secret_mode.toUpperCase()} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{tOr("admin.billingHealth.webhook", "Webhook")}</p>
            <StatusPill ok={health.stripe_webhook_configured} label={health.stripe_webhook_configured ? tOr("admin.billingHealth.configured", "Configured") : tOr("admin.billingHealth.missing", "Missing")} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{tOr("admin.billingHealth.subscriptionPrices", "Subscription Prices")}</p>
            <StatusPill ok={health.all_subscription_prices_configured} label={health.all_subscription_prices_configured ? tOr("admin.billingHealth.configured", "Configured") : tOr("admin.billingHealth.missing", "Missing")} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{tOr("admin.billingHealth.modeMatch", "Mode Match")}</p>
            <StatusPill ok={!health.has_mode_mismatch} label={health.has_mode_mismatch ? tOr("admin.billingHealth.mismatch", "Mismatch") : tOr("admin.billingHealth.ok", "OK")} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="py-1.5 pr-3 font-medium">{tOr("admin.billingHealth.colPrice", "Price")}</th>
                <th scope="col" className="px-3 py-1.5 font-medium">{tOr("admin.billingHealth.colConfigured", "Configured")}</th>
                <th scope="col" className="px-3 py-1.5 font-medium">{tOr("admin.billingHealth.colMode", "Mode")}</th>
                <th scope="col" className="px-3 py-1.5 font-medium">{tOr("admin.billingHealth.colActive", "Active")}</th>
                <th scope="col" className="py-1.5 pl-3 font-medium">{tOr("admin.billingHealth.colInterval", "Interval")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {health.prices.map((price) => (
                <tr key={price.label}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium text-zinc-700 dark:text-zinc-300">
                    {price.label}
                  </th>
                  <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{price.configured ? price.id_hint || tOr("admin.billingHealth.yes", "yes") : tOr("admin.billingHealth.missingLower", "missing")}</td>
                  <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{price.livemode == null ? "-" : price.livemode ? tOr("admin.billingHealth.live", "live") : tOr("admin.billingHealth.test", "test")}</td>
                  <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{price.active == null ? "-" : price.active ? tOr("admin.billingHealth.yes", "yes") : tOr("admin.billingHealth.no", "no")}</td>
                  <td className="py-1.5 pl-3 text-zinc-600 dark:text-zinc-400">{price.interval || price.currency || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function FunnelPanel({ funnel, title }: { funnel: AdminFunnel | null; title?: string }) {
  const { tOr } = useLocale();
  if (!funnel) return null;
  const signupUsers = funnel.stages[0]?.users || 0;
  return (
    <section className="dt-admin-panel overflow-hidden rounded-lg border">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {title || tOr("admin.funnel.title", "Monetization Funnel")}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {tOr("admin.funnel.subtitle", "Last {days} days, signup cohort conversion by unique users. Upgrade reminders are separated from blocking paywalls.", { days: funnel.days })}
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {funnel.stages.map((stage, index) => {
          const rate = index > 0 && signupUsers > 0 ? Math.round((stage.users / signupUsers) * 100) : null;
          return (
            <div key={stage.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{stage.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{formatNumber(stage.users)}</p>
              {rate != null ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tOr("admin.funnel.pctOfSignups", "{rate}% of signups", { rate })}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {funnel.reasons.length > 0 ? (
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{tOr("admin.funnel.topBillingReasons", "Top Billing Reasons")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {funnel.reasons.slice(0, 8).map((row, index) => (
                  <tr key={`${row.event_name}-${row.reason}-${row.source}-${index}`}>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{row.label || tOr("admin.funnel.paidSignal", "Paid signal")}</p>
                      <p className="mt-0.5 max-w-xl text-zinc-500 dark:text-zinc-400">{row.description || tOr("admin.funnel.noContext", "No context recorded.")}</p>
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {tOr("admin.funnel.usersEvents", "{users} users / {events} events", { users: row.users, events: row.events })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function RagQualityPanel({ quality }: { quality: AdminRagQuality | null }) {
  const { tOr } = useLocale();
  if (!quality) return null;
  const healthy = quality.evaluated_answers === 0 || (quality.fail_rate < 0.05 && quality.warn_rate < 0.1);
  const issueRows = quality.issue_breakdown.filter((item) => (item.count || 0) > 0).slice(0, 4);
  const strategyRows = quality.strategy_breakdown.slice(0, 4);
  return (
    <section className="dt-admin-panel overflow-hidden rounded-lg border">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {healthy ? (
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          )}
          <div>
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tOr("admin.rag.title", "Answer Citation Quality")}</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{quality.health_explanation}</p>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {tOr("admin.rag.healthSummary", "{label} / Last {days} days", { label: quality.health_label, days: quality.days })}
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <QualityMetric label={tOr("admin.rag.kpi.answersChecked", "Answers checked")} value={formatNumber(quality.evaluated_answers)} />
        <QualityMetric label={tOr("admin.rag.kpi.groundingScore", "Grounding score")} value={formatPercent(quality.average_score)} />
        <QualityMetric label={tOr("admin.rag.kpi.groundedReviewFailed", "Grounded / review / failed")} value={`${formatPercent(quality.pass_rate)} / ${formatPercent(quality.warn_rate)} / ${formatPercent(quality.fail_rate)}`} />
        <QualityMetric label={tOr("admin.rag.kpi.statementsMissingCitations", "Statements missing citations")} value={formatNumber(quality.uncited_claims)} />
        <QualityMetric label={tOr("admin.rag.kpi.weakSourceMatches", "Weak source matches")} value={formatNumber(quality.low_overlap_citations)} />
        <QualityMetric label={tOr("admin.rag.kpi.numberMismatches", "Number mismatches")} value={formatNumber(quality.numeric_mismatch_citations)} />
      </div>
      <div className="grid gap-4 border-t border-zinc-100 p-4 dark:border-zinc-800 lg:grid-cols-2">
        <IssueList
          title={tOr("admin.rag.whatNeedsFixing", "What needs fixing")}
          rows={issueRows.map((item) => ({
            key: item.key,
            label: item.label,
            detail: item.description,
            metric: formatNumber(item.count || 0),
          }))}
          empty={tOr("admin.rag.noIssues", "No citation issues in this window.")}
        />
        <IssueList
          title={tOr("admin.rag.whereItHappens", "Where it happens")}
          rows={strategyRows.map((item) => ({
            key: item.key,
            label: item.label,
            detail: item.description,
            metric: formatPercent(item.needs_review_rate),
          }))}
          empty={tOr("admin.rag.noStrategies", "No retrieval paths recorded yet.")}
        />
      </div>
    </section>
  );
}

function QualityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function IssueList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; detail: string; metric: string }[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{title}</h3>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-md border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">{empty}</p>
        ) : rows.map((item) => (
          <div key={item.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.detail}</p>
              </div>
              <p className="tabular-nums text-zinc-900 dark:text-zinc-100">{item.metric}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UserTablesPanel({
  recentUsers,
  topUsers,
  topBy,
  onTopByChange,
}: {
  recentUsers: RecentUser[];
  topUsers: TopUser[];
  topBy: "tokens" | "credits" | "documents";
  onTopByChange: (value: "tokens" | "credits" | "documents") => void;
}) {
  const { tOr } = useLocale();
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="dt-admin-panel overflow-hidden rounded-lg border">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tOr("admin.recentUsers.title", "Recent Users")}</h3>
        </div>
        <UserTable
          rows={recentUsers as unknown as Record<string, unknown>[]}
          empty={tOr("admin.recentUsers.empty", "No users yet")}
          columns={[
            { key: "email", label: tOr("admin.userCol.email", "Email") },
            { key: "plan", label: tOr("admin.userCol.plan", "Plan") },
            { key: "credits_balance", label: tOr("admin.userCol.credits", "Credits"), align: "right" },
            { key: "doc_count", label: tOr("admin.userCol.docs", "Docs"), align: "right" },
            { key: "created_at", label: tOr("admin.userCol.joined", "Joined") },
          ]}
        />
      </div>
      <div className="dt-admin-panel overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tOr("admin.topUsers.title", "Top Users")}</h3>
          <select
            value={topBy}
            onChange={(event) => onTopByChange(event.target.value as "tokens" | "credits" | "documents")}
            className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            aria-label={tOr("admin.topUsers.sortByAria", "Sort by")}
          >
            <option value="tokens">{tOr("admin.topUsers.byTokens", "By Tokens")}</option>
            <option value="credits">{tOr("admin.topUsers.byCredits", "By Credits")}</option>
            <option value="documents">{tOr("admin.topUsers.byDocuments", "By Documents")}</option>
          </select>
        </div>
        <UserTable
          rows={topUsers as unknown as Record<string, unknown>[]}
          empty={tOr("admin.topUsers.empty", "No usage data yet")}
          columns={[
            { key: "email", label: tOr("admin.userCol.email", "Email") },
            { key: "plan", label: tOr("admin.userCol.plan", "Plan") },
            { key: "total_tokens", label: tOr("admin.userCol.tokens", "Tokens"), align: "right" },
            { key: "total_credits", label: tOr("admin.userCol.credits", "Credits"), align: "right" },
            { key: "doc_count", label: tOr("admin.userCol.docs", "Docs"), align: "right" },
          ]}
        />
      </div>
    </section>
  );
}

function UserTable({
  rows,
  columns,
  empty,
}: {
  rows: Array<Record<string, unknown>>;
  columns: { key: string; label: string; align?: "right" | "left" }[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400 ${column.align === "right" ? "text-right" : "text-left"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={String(row.id)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-2 text-zinc-600 dark:text-zinc-400 ${column.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                >
                  {column.key === "plan" ? (
                    <PlanBadge plan={String(row[column.key] || "free")} />
                  ) : column.key === "created_at" ? (
                    row[column.key] ? new Date(String(row[column.key])).toLocaleDateString() : "-"
                  ) : typeof row[column.key] === "number" ? (
                    formatNumber(Number(row[column.key]))
                  ) : (
                    String(row[column.key] || "-")
                  )}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-400">{empty}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
