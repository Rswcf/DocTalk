"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import Header from "../../components/Header";
import { usePageTitle } from "../../lib/usePageTitle";
import { useLocale } from "../../i18n";
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
  getAdminRetention,
  getAdminChurn,
  type AdminBillingHealth,
  type AdminFunnel,
  type AdminRagQuality,
  type AdminUserActivity,
  type AdminRetention,
  type AdminChurn,
} from "../../lib/api";
import type { Overview, Trends, Breakdowns } from "../../components/admin/types";
import type { RecentUser, TopUser } from "../../components/admin/AdminPanels";
import OverviewTab from "../../components/admin/OverviewTab";
import ActivationTab from "../../components/admin/ActivationTab";
import RetentionTab from "../../components/admin/RetentionTab";
import ChurnTab from "../../components/admin/ChurnTab";
import RevenueTab from "../../components/admin/RevenueTab";
import ProductTab from "../../components/admin/ProductTab";

type TabId = "overview" | "activation" | "retention" | "churn" | "revenue" | "product";

const TABS: { id: TabId; key: string; fallback: string }[] = [
  { id: "overview", key: "admin.tab.overview", fallback: "Overview" },
  { id: "activation", key: "admin.tab.activation", fallback: "Activation" },
  { id: "retention", key: "admin.tab.retention", fallback: "Retention" },
  { id: "churn", key: "admin.tab.churn", fallback: "Why-not-retained" },
  { id: "revenue", key: "admin.tab.revenue", fallback: "Revenue" },
  { id: "product", key: "admin.tab.product", fallback: "Product" },
];

// Which backend datasets each tab needs (lazy-loaded on first open).
const TAB_DEPS: Record<TabId, string[]> = {
  overview: ["overview", "activity", "trends"],
  activation: ["activity", "funnel"],
  retention: ["retention"],
  churn: ["churn"],
  revenue: ["funnel", "billing"],
  product: ["rag", "trends", "breakdowns", "recentUsers", "topUsers"],
};
// Datasets that depend on the selected period (refetched when trendDays changes).
const PERIOD_DEPS = ["trends", "funnel", "rag", "activity"];

function isTabId(v: string | null): v is TabId {
  return !!v && TABS.some((t) => t.id === v);
}

export default function AdminPageClient() {
  const { tOr } = useLocale();
  usePageTitle(tOr("admin.pageTitle", "Admin"));
  const { status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [billingHealth, setBillingHealth] = useState<AdminBillingHealth | null>(null);
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [ragQuality, setRagQuality] = useState<AdminRagQuality | null>(null);
  const [userActivity, setUserActivity] = useState<AdminUserActivity | null>(null);
  const [retention, setRetention] = useState<AdminRetention | null>(null);
  const [churn, setChurn] = useState<AdminChurn | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);

  const [trendDays, setTrendDays] = useState(30);
  const [topBy, setTopBy] = useState<"tokens" | "credits" | "documents">("tokens");
  const [tabLoading, setTabLoading] = useState(false);
  const [billingRemoteLoading, setBillingRemoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadedRef = useRef<Set<string>>(new Set());

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth?callbackUrl=/admin");
  }, [status, router]);

  // Tab <-> URL hash sync (linkable tabs)
  useEffect(() => {
    const fromHash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (isTabId(fromHash)) setActiveTab(fromHash);
  }, []);

  const selectTab = useCallback((id: TabId) => {
    setActiveTab(id);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${id}`);
  }, []);

  const fetchers: Record<string, () => Promise<void>> = {
    overview: async () => setOverview((await getAdminOverview()) as Overview),
    activity: async () => setUserActivity(await getAdminUserActivity(trendDays, "day")),
    trends: async () => setTrends((await getAdminTrends("day", trendDays)) as Trends),
    funnel: async () => setFunnel(await getAdminFunnel(trendDays)),
    billing: async () => setBillingHealth(await getAdminBillingHealth(false)),
    rag: async () => setRagQuality(await getAdminRagQuality(trendDays)),
    breakdowns: async () => setBreakdowns((await getAdminBreakdowns()) as Breakdowns),
    recentUsers: async () =>
      setRecentUsers(((await getAdminRecentUsers(20)) as { users: RecentUser[] }).users),
    topUsers: async () =>
      setTopUsers(((await getAdminTopUsers(20, topBy)) as { users: TopUser[] }).users),
    retention: async () => setRetention(await getAdminRetention()),
    churn: async () => setChurn(await getAdminChurn(14)),
  };

  // Lazy-load the active tab's datasets on open / reload.
  useEffect(() => {
    let cancelled = false;
    const need = TAB_DEPS[activeTab].filter((k) => !loadedRef.current.has(k));
    if (need.length === 0) return;
    (async () => {
      setTabLoading(true);
      setError(null);
      try {
        await Promise.all(
          need.map(async (k) => {
            await fetchers[k]();
            loadedRef.current.add(k);
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg.includes("403") ? tOr("admin.error.forbidden", "Admin access required.") : tOr("admin.error.load", "Failed to load metrics."));
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reloadToken]);

  const changeTrendDays = useCallback((days: number) => {
    setTrendDays(days);
    PERIOD_DEPS.forEach((k) => loadedRef.current.delete(k));
    setReloadToken((t) => t + 1);
  }, []);

  const changeTopBy = useCallback((by: "tokens" | "credits" | "documents") => {
    setTopBy(by);
    loadedRef.current.delete("topUsers");
    setReloadToken((t) => t + 1);
  }, []);

  const refresh = useCallback(() => {
    loadedRef.current.clear();
    setReloadToken((t) => t + 1);
  }, []);

  const onRemoteCheck = useCallback(async () => {
    setBillingRemoteLoading(true);
    try {
      setBillingHealth(await getAdminBillingHealth(true));
    } catch {
      /* surfaced via error banner on next load */
    } finally {
      setBillingRemoteLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {tOr("admin.title", "Analytics")}
          </h1>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${tabLoading ? "animate-spin" : ""}`} />
            {tOr("admin.refresh", "Refresh")}
          </button>
        </div>

        {/* Sticky tab nav */}
        <nav className="sticky top-0 z-10 -mx-4 mb-6 border-b border-zinc-200 bg-zinc-50/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(t.id)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {tOr(t.key, t.fallback)}
                </button>
              );
            })}
          </div>
        </nav>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        {tabLoading && (
          <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.loading", "Loading…")}</div>
        )}

        <div role="tabpanel">
          {activeTab === "overview" && (
            <OverviewTab overview={overview} activity={userActivity} trends={trends} />
          )}
          {activeTab === "activation" && <ActivationTab activity={userActivity} funnel={funnel} />}
          {activeTab === "retention" && <RetentionTab retention={retention} />}
          {activeTab === "churn" && <ChurnTab churn={churn} />}
          {activeTab === "revenue" && (
            <RevenueTab
              funnel={funnel}
              billingHealth={billingHealth}
              billingRemoteLoading={billingRemoteLoading}
              onRemoteCheck={onRemoteCheck}
            />
          )}
          {activeTab === "product" && (
            <ProductTab
              ragQuality={ragQuality}
              trends={trends}
              breakdowns={breakdowns}
              trendDays={trendDays}
              onTrendDaysChange={changeTrendDays}
              recentUsers={recentUsers}
              topUsers={topUsers}
              topBy={topBy}
              onTopByChange={changeTopBy}
            />
          )}
        </div>
      </main>
    </div>
  );
}
