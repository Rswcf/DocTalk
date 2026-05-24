"use client";

import dynamic from "next/dynamic";
import type { AdminRagQuality } from "../../lib/api";
import { RagQualityPanel, UserTablesPanel, type RecentUser, type TopUser } from "./AdminPanels";
import type { Breakdowns, Trends } from "./types";

const AdminCharts = dynamic<{
  trends: Trends;
  breakdowns: Breakdowns;
  trendDays: number;
  onTrendDaysChange: (days: number) => void;
}>(() => import("../AdminCharts"), { ssr: false });

export default function ProductTab({
  ragQuality,
  trends,
  breakdowns,
  trendDays,
  onTrendDaysChange,
  recentUsers,
  topUsers,
  topBy,
  onTopByChange,
}: {
  ragQuality: AdminRagQuality | null;
  trends: Trends | null;
  breakdowns: Breakdowns | null;
  trendDays: number;
  onTrendDaysChange: (days: number) => void;
  recentUsers: RecentUser[];
  topUsers: TopUser[];
  topBy: "tokens" | "credits" | "documents";
  onTopByChange: (value: "tokens" | "credits" | "documents") => void;
}) {
  return (
    <div className="space-y-6">
      <RagQualityPanel quality={ragQuality} />
      {trends && breakdowns ? (
        <AdminCharts
          trends={trends}
          breakdowns={breakdowns}
          trendDays={trendDays}
          onTrendDaysChange={onTrendDaysChange}
        />
      ) : null}
      <UserTablesPanel
        recentUsers={recentUsers}
        topUsers={topUsers}
        topBy={topBy}
        onTopByChange={onTopByChange}
      />
    </div>
  );
}
