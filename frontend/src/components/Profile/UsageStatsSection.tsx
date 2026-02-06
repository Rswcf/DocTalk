"use client";

import React, { useEffect, useState } from "react";
import type { UserProfile, UsageBreakdown } from "../../types";
import { useLocale } from "../../i18n";
import { getUsageBreakdown } from "../../lib/api";
import { FileText, MessageSquare, Layers, Coins, Sigma } from "lucide-react";

interface Props {
  profile: UserProfile;
}

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
      } catch (e) {
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

  const cards = [
    { icon: FileText, value: profile.stats.total_documents, label: t("profile.usage.documents") },
    { icon: Layers, value: profile.stats.total_sessions, label: t("profile.usage.sessions") },
    { icon: MessageSquare, value: profile.stats.total_messages, label: t("profile.usage.messages") },
    { icon: Coins, value: profile.stats.total_credits_spent, label: t("profile.usage.creditsSpent") },
    { icon: Sigma, value: profile.stats.total_tokens_used, label: t("profile.usage.tokensUsed") },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c, idx) => (
          <div key={idx} className="border rounded-lg p-6 dark:border-gray-700 flex flex-col items-start gap-2">
            <c.icon className="text-gray-500 dark:text-gray-400" size={18} />
            <div className="text-2xl font-semibold dark:text-gray-100">{c.value.toLocaleString()}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Model breakdown */}
      <div>
        <h3 className="text-lg font-medium mb-3 dark:text-gray-100">{t("profile.usage.modelBreakdown")}</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-transparent rounded-full" />
            <span>{t("common.loading")}</span>
          </div>
        ) : error ? (
          <div className="text-gray-600 dark:text-gray-400">–</div>
        ) : breakdown && breakdown.by_model.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="pb-2 font-medium">{t("profile.usage.model")}</th>
                  <th className="pb-2 font-medium">{t("profile.usage.calls")}</th>
                  <th className="pb-2 font-medium">{t("profile.usage.tokens")}</th>
                  <th className="pb-2 font-medium">{t("profile.usage.credits")}</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.by_model.map((row, i) => (
                  <tr key={i} className="border-t dark:border-gray-800">
                    <td className="py-2 text-gray-700 dark:text-gray-300">{row.model}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{row.total_calls.toLocaleString()}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{row.total_tokens.toLocaleString()}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{row.total_credits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-600 dark:text-gray-400">–</div>
        )}
      </div>
    </div>
  );
}

