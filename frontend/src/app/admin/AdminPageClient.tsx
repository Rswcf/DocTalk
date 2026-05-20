"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "../../components/Header";
import {
  getAdminOverview,
  getAdminTrends,
  getAdminBreakdowns,
  getAdminBillingHealth,
  getAdminFunnel,
  getAdminRagQuality,
  getAdminUserActivity,
  getAdminRecentUsers,
  getAdminTopUsers,
  type AdminBillingHealth,
  type AdminFunnel,
  type AdminRagQuality,
  type AdminUserActivity,
} from "../../lib/api";
import {
  Users,
  FileText,
  MessageSquare,
  Zap,
  CreditCard,
  Gift,
  Crown,
  Star,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useLocale } from "../../i18n";

// Types
interface Overview {
  total_users: number;
  paid_users: number;
  plus_users: number;
  pro_users: number;
  total_documents: number;
  total_sessions: number;
  total_messages: number;
  total_tokens: number;
  total_credits_spent: number;
  total_credits_granted: number;
}

interface TrendPoint {
  date: string;
  count?: number;
  total_tokens?: number;
  amount?: number;
}

interface Trends {
  signups: TrendPoint[];
  documents: TrendPoint[];
  tokens: TrendPoint[];
  credits_spent: TrendPoint[];
  active_users: TrendPoint[];
}

interface Breakdowns {
  plan_distribution: { plan: string; count: number }[];
  model_usage: { model: string; calls: number; tokens: number; credits: number }[];
  file_types: { file_type: string; count: number }[];
  doc_status: { status: string; count: number }[];
}

interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  credits_balance: number;
  created_at: string | null;
  doc_count: number;
  message_count: number;
}

interface TopUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  total_tokens: number;
  total_credits: number;
  doc_count: number;
}

const AdminCharts = dynamic<{
  trends: Trends;
  breakdowns: Breakdowns;
  trendDays: number;
  onTrendDaysChange: (days: number) => void;
}>(() => import("../../components/AdminCharts"), { ssr: false });

const AdminUserActivityCharts = dynamic<{
  activity: AdminUserActivity;
}>(() => import("../../components/AdminUserActivityCharts"), { ssr: false });

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function KPICard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="dt-kpi-card rounded-2xl p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-xl bg-accent-light">
        <Icon aria-hidden="true" className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {formatNumber(value)}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    plus: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    pro: "bg-accent-light text-accent",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[plan] || colors.free}`}
    >
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

function BillingHealthPanel({
  health,
  loadingRemote,
  onRemoteCheck,
}: {
  health: AdminBillingHealth | null;
  loadingRemote: boolean;
  onRemoteCheck: () => void;
}) {
  if (!health) return null;
  const liveReady = health.stripe_secret_mode === "live"
    && health.stripe_webhook_configured
    && health.all_subscription_prices_configured
    && !health.has_mode_mismatch;

  return (
    <section className="dt-admin-panel mb-8 overflow-hidden border">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {liveReady ? (
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          )}
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Billing Health</h2>
        </div>
        <button
          type="button"
          onClick={onRemoteCheck}
          disabled={loadingRemote}
          className="inline-flex items-center justify-center gap-2 rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loadingRemote ? "animate-spin" : ""}`} />
          Verify Stripe
        </button>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Secret Mode</p>
            <StatusPill ok={health.stripe_secret_mode === "live"} label={health.stripe_secret_mode.toUpperCase()} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Webhook</p>
            <StatusPill ok={health.stripe_webhook_configured} label={health.stripe_webhook_configured ? "Configured" : "Missing"} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Subscription Prices</p>
            <StatusPill ok={health.all_subscription_prices_configured} label={health.all_subscription_prices_configured ? "Configured" : "Missing"} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Mode Match</p>
            <StatusPill ok={!health.has_mode_mismatch} label={health.has_mode_mismatch ? "Mismatch" : "OK"} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="py-1.5 pr-3 font-medium">Price</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Configured</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Mode</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Active</th>
                <th scope="col" className="py-1.5 pl-3 font-medium">Interval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {health.prices.map((price) => (
                <tr key={price.label}>
                  <th
                    scope="row"
                    className="py-1.5 pr-3 text-zinc-700 dark:text-zinc-300"
                    style={{ textAlign: "left", fontWeight: 500 }}
                  >
                    {price.label}
                  </th>
                  <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{price.configured ? price.id_hint || "yes" : "missing"}</td>
                  <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{price.livemode == null ? "-" : price.livemode ? "live" : "test"}</td>
                  <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{price.active == null ? "-" : price.active ? "yes" : "no"}</td>
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

function FunnelPanel({ funnel }: { funnel: AdminFunnel | null }) {
  if (!funnel) return null;
  const signupUsers = funnel.stages[0]?.users || 0;
  const hasPaidIntentEvents = funnel.stages
    .filter((stage) => [
      "upgrade_nudge_shown",
      "paywall_opened",
      "limit_hit",
      "billing_view",
      "upgrade_click",
      "checkout_created",
      "checkout_completed",
      "subscription_cancel_requested",
      "refund_requested",
    ].includes(stage.key))
    .some((stage) => stage.users > 0);
  return (
    <section className="dt-admin-panel mb-8 overflow-hidden border">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Monetization Funnel</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Last {funnel.days} days, signup cohort conversion by unique users. Upgrade reminders are separated from blocking paywalls.
          {!funnel.event_tracking_started_at && " Paid-intent event tracking has no recorded events yet."}
        </p>
        {funnel.event_tracking_started_at && !hasPaidIntentEvents && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Paid-intent events are counted only since {new Date(funnel.event_tracking_started_at).toLocaleDateString()}; earlier pricing and billing activity is not backfilled.
          </p>
        )}
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {funnel.stages.map((stage, index) => {
          const rate = index > 0 && signupUsers > 0 ? Math.round((stage.users / signupUsers) * 100) : null;
          return (
            <div key={stage.key} className="rounded border border-zinc-100 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{stage.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(stage.users)}</p>
              {rate != null && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{rate}% of signups</p>
              )}
            </div>
          );
        })}
      </div>
      {funnel.reasons.length > 0 && (
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Top Billing Reasons</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {funnel.reasons.slice(0, 8).map((row, index) => (
                  <tr key={`${row.event_name}-${row.reason}-${row.source}-${index}`}>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{row.label || "Paid signal"}</p>
                      <p className="mt-0.5 max-w-xl text-zinc-500 dark:text-zinc-400">{row.description || "No context recorded."}</p>
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.users} users / {row.events} events
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function RagQualityPanel({ quality }: { quality: AdminRagQuality | null }) {
  if (!quality) return null;
  const healthy = quality.evaluated_answers === 0 || (quality.fail_rate < 0.05 && quality.warn_rate < 0.1);
  const issueRows = quality.issue_breakdown.filter((item) => (item.count || 0) > 0).slice(0, 4);
  const strategyRows = quality.strategy_breakdown.slice(0, 4);
  return (
    <section className="dt-admin-panel mb-8 overflow-hidden border">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {healthy ? (
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          )}
          <div>
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Answer Citation Quality</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{quality.health_explanation}</p>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {quality.health_label} · Last {quality.days} days{quality.is_sampled ? ` · latest ${formatNumber(quality.sample_limit)} sample` : ""}
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Answers checked</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(quality.evaluated_answers)}</p>
        </div>
        <div className="rounded border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Grounding score</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatPercent(quality.average_score)}</p>
        </div>
        <div className="rounded border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Grounded / review / failed</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatPercent(quality.pass_rate)} / {formatPercent(quality.warn_rate)} / {formatPercent(quality.fail_rate)}
          </p>
        </div>
        <div className="rounded border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Statements missing citations</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(quality.uncited_claims)}</p>
        </div>
        <div className="rounded border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Weak source matches</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(quality.low_overlap_citations)}</p>
        </div>
        <div className="rounded border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Number mismatches</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(quality.numeric_mismatch_citations)}</p>
        </div>
      </div>
      {(issueRows.length > 0 || strategyRows.length > 0) && (
        <div className="grid gap-4 border-t border-zinc-100 p-4 dark:border-zinc-800 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">What needs fixing</h3>
            <div className="space-y-3">
              {issueRows.length === 0 && (
                <p className="rounded-md border border-zinc-100 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  No citation issues in this window.
                </p>
              )}
              {issueRows.map((item) => (
                <div key={item.key} className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.description}</p>
                    </div>
                    <div className="text-right text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                      <p className="font-semibold">{formatNumber(item.count || 0)}</p>
                      <p className="mt-0.5 text-zinc-400">{formatNumber(item.affected_answers || 0)} answers</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Where it happens</h3>
            <div className="space-y-3">
              {strategyRows.length === 0 && (
                <p className="rounded-md border border-zinc-100 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  No retrieval paths recorded yet.
                </p>
              )}
              {strategyRows.map((item) => (
                <div key={item.key} className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.description}</p>
                    </div>
                    <div className="text-right text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                      <p className="font-semibold">{formatPercent(item.needs_review_rate)}</p>
                      <p className="mt-0.5 text-zinc-400">{item.needs_review}/{item.answers} need review</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {quality.recent.length > 0 && (
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Recent checked answers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {quality.recent.slice(0, 8).map((row, index) => (
                  <tr key={`${row.created_at}-${index}`}>
                    <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{row.status_label}</td>
                    <td className="px-3 py-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">{formatPercent(row.score)}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.route_label || "Unknown question type"}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.strategy_label || "Unknown retrieval path"}</td>
                    <td className="py-2 pl-3 text-right text-zinc-700 dark:text-zinc-300">
                      <p>{row.main_issue?.label || "No major issue"}</p>
                      <p className="mt-0.5 tabular-nums text-zinc-400">
                        {row.claim_count} statements / {row.citation_count} citations
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminPageClient() {
  usePageTitle("Admin");
  const { tOr } = useLocale();

  const { status } = useSession();
  const router = useRouter();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [billingHealth, setBillingHealth] = useState<AdminBillingHealth | null>(null);
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [ragQuality, setRagQuality] = useState<AdminRagQuality | null>(null);
  const [userActivity, setUserActivity] = useState<AdminUserActivity | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billingRemoteLoading, setBillingRemoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState(30);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [topBy, setTopBy] = useState<"tokens" | "credits" | "documents">("tokens");

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/admin");
    }
  }, [status, router]);

  // Fetch all data
  const fetchData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [ov, tr, br, ru, tu, bh, fn, rq, ua] = await Promise.all([
        getAdminOverview(),
        getAdminTrends("day", trendDays),
        getAdminBreakdowns(),
        getAdminRecentUsers(20),
        getAdminTopUsers(20, topBy),
        getAdminBillingHealth(false),
        getAdminFunnel(trendDays),
        getAdminRagQuality(trendDays),
        getAdminUserActivity(trendDays, "day"),
      ]);
      setOverview(ov as Overview);
      setTrends(tr as Trends);
      setBreakdowns(br as Breakdowns);
      setRecentUsers((ru as { users: RecentUser[] }).users);
      setTopUsers((tu as { users: TopUser[] }).users);
      setBillingHealth(bh);
      setFunnel(fn);
      setRagQuality(rq);
      setUserActivity(ua);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e: any) {
      if (e?.message?.includes("403")) {
        router.push("/");
        return;
      }
      setError(e?.message || "Failed to load admin data");
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [trendDays, topBy, router]);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchData();
    }
  }, [status, fetchData]);

  useEffect(() => {
    if (status !== "authenticated" || refreshInterval <= 0) return;
    const timer = window.setInterval(() => {
      void fetchData(true);
    }, refreshInterval * 1000);
    return () => window.clearInterval(timer);
  }, [status, refreshInterval, fetchData]);

  const verifyBillingRemote = useCallback(async () => {
    setBillingRemoteLoading(true);
    try {
      const health = await getAdminBillingHealth(true);
      setBillingHealth(health);
    } catch (e: any) {
      setError(e?.message || "Failed to verify billing health");
    } finally {
      setBillingRemoteLoading(false);
    }
  }, []);

  if (status === "loading" || (status === "authenticated" && loading && !overview)) {
    return (
      <div className="dt-stitch-theme dt-admin-workbench min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto p-6 sm:p-8">
          <h1 className="text-2xl font-semibold mb-6 dark:text-zinc-100">
            Admin Dashboard
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-5 animate-pulse"
              >
                <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
                <div className="h-4 w-28 bg-zinc-100 dark:bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dt-stitch-theme dt-admin-workbench min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto p-6 sm:p-8">
          <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {error}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dt-stitch-theme dt-admin-workbench min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto p-6 sm:p-8">
        <div className="dt-glass-panel mb-6 flex flex-col gap-4 rounded-[1.75rem] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-white/14 bg-white/8 px-2.5 py-1 text-xs font-medium text-[var(--workbench-muted)]">
              {tOr('admin.workbenchEyebrow', 'Live business intelligence')}
            </p>
            <h1 className="text-3xl font-semibold tracking-normal text-[var(--workbench-ink)]">
              {tOr('admin.workbenchTitle', 'Admin Insight Workbench')}
            </h1>
            <p className="mt-1 text-xs text-[var(--workbench-muted)]">
              {lastRefreshedAt ? `Last refreshed ${new Date(lastRefreshedAt).toLocaleTimeString()}` : tOr('admin.loadingLiveMetrics', 'Loading live metrics')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={trendDays}
              onChange={(event) => setTrendDays(Number(event.target.value))}
              className="dt-workbench-button rounded-full px-3 py-2 text-sm"
              aria-label="Activity window"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
            </select>
            <select
              value={refreshInterval}
              onChange={(event) => setRefreshInterval(Number(event.target.value))}
              className="dt-workbench-button rounded-full px-3 py-2 text-sm"
              aria-label="Auto-refresh interval"
            >
              <option value={0}>Manual refresh</option>
              <option value={30}>30s refresh</option>
              <option value={60}>60s refresh</option>
              <option value={300}>5m refresh</option>
            </select>
            <button
              type="button"
              onClick={() => void fetchData(true)}
              disabled={refreshing || loading}
              className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing || loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            <KPICard icon={Users} label="Total Users" value={overview.total_users} />
            <KPICard icon={Crown} label="Paid Users" value={overview.paid_users} />
            <KPICard icon={Star} label="Plus Users" value={overview.plus_users} />
            <KPICard icon={Star} label="Pro Users" value={overview.pro_users} />
            <KPICard icon={FileText} label="Documents" value={overview.total_documents} />
            <KPICard icon={MessageSquare} label="Messages" value={overview.total_messages} />
            <KPICard icon={Zap} label="Total Tokens" value={overview.total_tokens} />
            <KPICard icon={CreditCard} label="Credits Spent" value={overview.total_credits_spent} />
            <KPICard icon={Gift} label="Credits Granted" value={overview.total_credits_granted} />
          </div>
        )}

        {userActivity && (
          <AdminUserActivityCharts activity={userActivity} />
        )}

        <BillingHealthPanel
          health={billingHealth}
          loadingRemote={billingRemoteLoading}
          onRemoteCheck={verifyBillingRemote}
        />

        <FunnelPanel funnel={funnel} />

        <RagQualityPanel quality={ragQuality} />

        {trends && breakdowns && (
          <AdminCharts
            trends={trends}
            breakdowns={breakdowns}
            trendDays={trendDays}
            onTrendDaysChange={setTrendDays}
          />
        )}

        {/* Tables */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Users */}
          <div className="dt-admin-panel overflow-hidden border">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-medium dark:text-zinc-100">
                Recent Users
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th scope="col" className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Email
                    </th>
                    <th scope="col" className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Plan
                    </th>
                    <th scope="col" className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Credits
                    </th>
                    <th scope="col" className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Docs
                    </th>
                    <th scope="col" className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <th
                        scope="row"
                        className="px-4 py-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]"
                        style={{ textAlign: "left", fontWeight: 500 }}
                      >
                        {u.email}
                      </th>
                      <td className="px-4 py-2">
                        <PlanBadge plan={u.plan} />
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {formatNumber(u.credits_balance)}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {u.doc_count}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                  {recentUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                        No users yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Users */}
          <div className="dt-admin-panel overflow-hidden border">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h3 className="text-sm font-medium dark:text-zinc-100">Top Users</h3>
              <select
                value={topBy}
                onChange={(e) =>
                  setTopBy(e.target.value as "tokens" | "credits" | "documents")
                }
                className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-transparent dark:text-zinc-300"
                aria-label="Sort by"
              >
                <option value="tokens">By Tokens</option>
                <option value="credits">By Credits</option>
                <option value="documents">By Documents</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th scope="col" className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Email
                    </th>
                    <th scope="col" className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Plan
                    </th>
                    <th scope="col" className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Tokens
                    </th>
                    <th scope="col" className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Credits
                    </th>
                    <th scope="col" className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Docs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {topUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <th
                        scope="row"
                        className="px-4 py-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]"
                        style={{ textAlign: "left", fontWeight: 500 }}
                      >
                        {u.email}
                      </th>
                      <td className="px-4 py-2">
                        <PlanBadge plan={u.plan} />
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {formatNumber(u.total_tokens)}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {formatNumber(u.total_credits)}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {u.doc_count}
                      </td>
                    </tr>
                  ))}
                  {topUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                        No usage data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
