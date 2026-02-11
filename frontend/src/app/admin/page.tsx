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
  getAdminRecentUsers,
  getAdminTopUsers,
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
} from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";

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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
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
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
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
    pro: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[plan] || colors.free}`}
    >
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

export default function AdminPage() {
  usePageTitle("Admin");

  const { status } = useSession();
  const router = useRouter();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState(30);
  const [topBy, setTopBy] = useState<"tokens" | "credits" | "documents">("tokens");

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/admin");
    }
  }, [status, router]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, tr, br, ru, tu] = await Promise.all([
        getAdminOverview(),
        getAdminTrends("day", trendDays),
        getAdminBreakdowns(),
        getAdminRecentUsers(20),
        getAdminTopUsers(20, topBy),
      ]);
      setOverview(ov as Overview);
      setTrends(tr as Trends);
      setBreakdowns(br as Breakdowns);
      setRecentUsers((ru as { users: RecentUser[] }).users);
      setTopUsers((tu as { users: TopUser[] }).users);
    } catch (e: any) {
      if (e?.message?.includes("403")) {
        router.push("/");
        return;
      }
      setError(e?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [trendDays, topBy, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, fetchData]);

  if (status === "loading" || (status === "authenticated" && loading && !overview)) {
    return (
      <div className="min-h-screen dark:bg-zinc-950">
        <Header />
        <main className="max-w-7xl mx-auto p-6 sm:p-8">
          <h1 className="text-2xl font-semibold mb-6 dark:text-zinc-100">
            Admin Dashboard
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-5 animate-pulse"
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
      <div className="min-h-screen dark:bg-zinc-950">
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
    <div className="min-h-screen dark:bg-zinc-950">
      <Header />
      <main className="max-w-7xl mx-auto p-6 sm:p-8">
        <h1 className="text-2xl font-semibold mb-6 dark:text-zinc-100">
          Admin Dashboard
        </h1>

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
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-medium dark:text-zinc-100">
                Recent Users
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Email
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Plan
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Credits
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Docs
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                        {u.email}
                      </td>
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
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
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
                    <th className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Email
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Plan
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Tokens
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Credits
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                      Docs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {topUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                        {u.email}
                      </td>
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
