"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

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

export interface AdminChartsProps {
  trends: Trends;
  breakdowns: Breakdowns;
  trendDays: number;
  onTrendDaysChange: (days: number) => void;
}

const PIE_COLORS = ["#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#27272a", "#18181b"];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function ChartCard({
  title,
  data,
  dataKey,
}: {
  title: string;
  data: TrendPoint[];
  dataKey: string;
}) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
        {title}
      </h3>
      <div className="h-48">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#71717a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-zinc-200 dark:text-zinc-700"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                className="text-zinc-500"
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-zinc-500"
                tickFormatter={formatNumber}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--background, #fff)",
                  border: "1px solid var(--border, #e4e4e7)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(v) => [formatNumber(Number(v ?? 0)), title]}
                labelFormatter={(l) => new Date(String(l)).toLocaleDateString()}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="#52525b"
                fill={`url(#grad-${dataKey})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function PieCard({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
        {title}
      </h3>
      <div className="h-64 flex items-center">
        {data.length === 0 ? (
          <div className="w-full text-center text-zinc-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--background, #fff)",
                  border: "1px solid var(--border, #e4e4e7)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function AdminCharts({
  trends,
  breakdowns,
  trendDays,
  onTrendDaysChange,
}: AdminChartsProps) {
  return (
    <>
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold dark:text-zinc-100">Trends</h2>
          <div className="flex gap-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => onTrendDaysChange(d)}
                className={`px-3 py-1 rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-1 ${
                  trendDays === d
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="User Signups" data={trends.signups} dataKey="count" />
          <ChartCard title="Active Users" data={trends.active_users} dataKey="count" />
          <ChartCard
            title="Token Consumption"
            data={trends.tokens}
            dataKey="total_tokens"
          />
          <ChartCard
            title="Credits Spent"
            data={trends.credits_spent}
            dataKey="amount"
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 dark:text-zinc-100">
          Distributions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <PieCard
            title="Plan Distribution"
            data={breakdowns.plan_distribution.map((d) => ({
              name: d.plan.charAt(0).toUpperCase() + d.plan.slice(1),
              value: d.count,
            }))}
          />
          <PieCard
            title="File Types"
            data={breakdowns.file_types.map((d) => ({
              name: d.file_type.toUpperCase(),
              value: d.count,
            }))}
          />
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
              Model Usage (tokens)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={breakdowns.model_usage.map((m) => ({
                    name: m.model.split("/").pop(),
                    tokens: m.tokens,
                  }))}
                  layout="vertical"
                  margin={{ left: 80, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-700"
                  />
                  <XAxis type="number" tickFormatter={formatNumber} tick={{ fontSize: 12 }} className="text-zinc-500" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} className="text-zinc-500" width={80} />
                  <Tooltip
                    formatter={(v) => formatNumber(Number(v ?? 0))}
                    contentStyle={{
                      background: "var(--background, #fff)",
                      border: "1px solid var(--border, #e4e4e7)",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                  <Bar dataKey="tokens" fill="#71717a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
