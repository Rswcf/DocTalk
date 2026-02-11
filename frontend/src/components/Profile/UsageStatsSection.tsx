"use client";

import React, { useEffect, useState } from "react";
import type { UserProfile, UsageBreakdown } from "../../types";
import { useLocale } from "../../i18n";
import { getUsageBreakdown } from "../../lib/api";
import {
  FileText,
  MessageSquare,
  Layers,
  Coins,
  Zap,
  Scale,
  Microscope,
  Circle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  profile: UserProfile;
}

const MODE_ORDER = ["quick", "balanced", "thorough", "other"] as const;

const MODE_CONFIG: Record<string, { icon: LucideIcon; labelKey: string }> = {
  quick: { icon: Zap, labelKey: "profile.usage.mode.quick" },
  balanced: { icon: Scale, labelKey: "profile.usage.mode.balanced" },
  thorough: { icon: Microscope, labelKey: "profile.usage.mode.thorough" },
  other: { icon: Circle, labelKey: "profile.usage.mode.other" },
};

export default function UsageStatsSection({ profile }: Props) {
  const { t } = useLocale();
  const [breakdown, setBreakdown] = useState<UsageBreakdown | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getUsageBreakdown();
        if (!cancelled) setBreakdown(data);
      } catch {
        if (!cancelled) setError("error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = [
    { icon: FileText, value: profile.stats.total_documents, label: t("profile.usage.documents") },
    { icon: Layers, value: profile.stats.total_sessions, label: t("profile.usage.sessions") },
    { icon: MessageSquare, value: profile.stats.total_messages, label: t("profile.usage.messages") },
    { icon: Coins, value: profile.stats.total_credits_spent, label: t("profile.usage.creditsSpent") },
  ];

  // Sort modes in fixed order, filter out zero-call "other"
  const sortedModes = breakdown
    ? MODE_ORDER
        .filter((m) => breakdown.by_mode.some((r) => r.mode === m))
        .map((m) => breakdown.by_mode.find((r) => r.mode === m)!)
        .filter((r) => r.mode !== "other" || r.total_calls > 0)
    : [];

  const grandTotalCalls = sortedModes.reduce((s, r) => s + r.total_calls, 0);
  const grandTotalCredits = sortedModes.reduce((s, r) => s + r.total_credits, 0);
  const hasOther = sortedModes.some((r) => r.mode === "other");

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards (4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((c, idx) => (
          <div key={idx} className="border rounded-lg p-6 dark:border-zinc-700 flex flex-col items-start gap-2">
            <c.icon aria-hidden="true" className="text-zinc-500 dark:text-zinc-400" size={18} />
            <div className="text-2xl font-semibold dark:text-zinc-100 tabular-nums">{c.value.toLocaleString()}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Mode breakdown */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <div className="animate-spin h-5 w-5 border-2 border-zinc-300 border-t-transparent rounded-full" />
          <span>{t("common.loading")}</span>
        </div>
      ) : error ? (
        <div className="text-zinc-600 dark:text-zinc-400">&ndash;</div>
      ) : sortedModes.length > 0 ? (
        <>
          {/* Mode summary cards */}
          <div>
            <h3 className="text-lg font-medium mb-3 dark:text-zinc-100">{t("profile.usage.modeBreakdown")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {sortedModes
                .filter((r) => r.mode !== "other")
                .map((row) => {
                  const cfg = MODE_CONFIG[row.mode] || MODE_CONFIG.other;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={row.mode}
                      className="border rounded-xl p-4 dark:border-zinc-700 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-zinc-600 dark:text-zinc-400" />
                        <span className="font-medium dark:text-zinc-100">{t(cfg.labelKey)}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-xl font-semibold tabular-nums dark:text-zinc-100">
                          {row.total_calls.toLocaleString()}
                        </span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{t("profile.usage.chats")}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-xl font-semibold tabular-nums dark:text-zinc-100">
                          {row.total_credits.toLocaleString()}
                        </span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{t("profile.usage.credits")}</span>
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
                        ~{row.avg_credits_per_chat} {t("profile.usage.avgPerChat")}
                      </div>
                      {/* Share bar */}
                      <div className="mt-1">
                        <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
                          <div
                            className="h-1.5 rounded-full bg-zinc-800 dark:bg-zinc-200 transition-[width] duration-300"
                            style={{ width: `${Math.max(row.share, 1)}%` }}
                          />
                        </div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 tabular-nums">
                          {row.share}% {t("profile.usage.share")}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Detailed breakdown table */}
          <div>
            <h3 className="text-lg font-medium mb-3 dark:text-zinc-100">{t("profile.usage.detailedBreakdown")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="pb-2 font-medium">{t("profile.usage.model")}</th>
                    <th className="pb-2 font-medium text-right">{t("profile.usage.chats")}</th>
                    <th className="pb-2 font-medium text-right">{t("profile.usage.credits")}</th>
                    <th className="pb-2 font-medium text-right">{t("profile.usage.avgPerChat")}</th>
                    <th className="pb-2 font-medium text-right">{t("profile.usage.share")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModes.map((row) => {
                    const cfg = MODE_CONFIG[row.mode] || MODE_CONFIG.other;
                    const Icon = cfg.icon;
                    const isOther = row.mode === "other";
                    return (
                      <tr
                        key={row.mode}
                        className={
                          isOther
                            ? "border-t border-dashed dark:border-zinc-700 text-zinc-400 dark:text-zinc-500"
                            : "border-t dark:border-zinc-800"
                        }
                      >
                        <td className="py-2 flex items-center gap-2">
                          <Icon size={14} className={isOther ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"} />
                          <span className={isOther ? "" : "text-zinc-700 dark:text-zinc-300"}>{t(cfg.labelKey)}</span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {row.total_calls.toLocaleString()}
                        </td>
                        <td className="py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {row.total_credits.toLocaleString()}
                        </td>
                        <td className="py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          ~{row.avg_credits_per_chat}
                        </td>
                        <td className="py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                          {isOther ? "\u2014" : `${row.share}%`}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="border-t-2 dark:border-zinc-700 font-semibold">
                    <td className="py-2 dark:text-zinc-100">{t("profile.usage.total")}</td>
                    <td className="py-2 text-right tabular-nums dark:text-zinc-100">{grandTotalCalls.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums dark:text-zinc-100">{grandTotalCredits.toLocaleString()}</td>
                    <td className="py-2 text-right" />
                    <td className="py-2 text-right" />
                  </tr>
                </tbody>
              </table>
            </div>
            {hasOther && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                {t("profile.usage.otherNote")}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
          {t("profile.usage.noData")}
        </div>
      )}
    </div>
  );
}
