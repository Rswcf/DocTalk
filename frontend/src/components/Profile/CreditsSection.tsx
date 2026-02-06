"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { UserProfile, CreditHistoryItem } from "../../types";
import { useLocale } from "../../i18n";
import {
  createPortalSession,
  createSubscription,
  getCreditHistory,
} from "../../lib/api";
import { useRouter } from "next/navigation";

interface Props {
  profile: UserProfile;
}

export default function CreditsSection({ profile }: Props) {
  const { t } = useLocale();
  const router = useRouter();

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [items, setItems] = useState<CreditHistoryItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(20);
  const [offset, setOffset] = useState<number>(0);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const balanceColor = useMemo(() => {
    const n = profile.credits_balance || 0;
    if (n > 1000) return "text-green-600";
    if (n >= 100) return "text-yellow-600";
    return "text-red-600";
  }, [profile.credits_balance]);

  const used = useMemo(() => {
    const u = (profile.monthly_allowance || 0) - (profile.credits_balance || 0);
    return Math.max(0, u);
  }, [profile.monthly_allowance, profile.credits_balance]);

  const totalAllowance = profile.monthly_allowance || 0;
  const percentUsed = totalAllowance > 0 ? Math.min(100, Math.max(0, (used / totalAllowance) * 100)) : 0;
  const barColor = percentUsed < 50 ? "bg-green-500" : percentUsed < 80 ? "bg-yellow-500" : "bg-red-500";

  useEffect(() => {
    let cancelled = false;
    async function load(pageOffset: number) {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const data = await getCreditHistory(limit, pageOffset);
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (e) {
        if (!cancelled) setHistoryError("error");
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    load(offset);
    return () => {
      cancelled = true;
    };
  }, [limit, offset]);

  const onUpgrade = async () => {
    setSubmitting(true);
    try {
      const res = await createSubscription();
      window.location.href = res.checkout_url;
    } catch (e) {
      // swallow; could show toast
    } finally {
      setSubmitting(false);
    }
  };

  const onManage = async () => {
    setSubmitting(true);
    try {
      const res = await createPortalSession();
      window.location.href = res.portal_url;
    } catch (e) {
      // swallow; could show toast
    } finally {
      setSubmitting(false);
    }
  };

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex flex-col gap-6">
      {/* Balance and Plan */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">{t("profile.credits.balance")}</div>
          <div className={`text-3xl font-bold ${balanceColor}`}>
            {profile.credits_balance.toLocaleString()} {t("credits.credits")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              `px-2 py-1 rounded text-xs font-medium ` +
              (profile.plan === "pro"
                ? `bg-gradient-to-r from-zinc-500 to-indigo-600 text-white`
                : `bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`)
            }
          >
            {profile.plan === "pro" ? t("profile.plan.pro") : t("profile.plan.free")}
          </span>
        </div>
      </div>

      {/* Allowance progress */}
      <div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("profile.plan.monthlyAllowance", {
            used: Math.min(used, totalAllowance).toLocaleString(),
            total: totalAllowance.toLocaleString(),
          })}
        </div>
        <div className="mt-2 h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`${barColor} h-full`} 
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        {profile.plan === "free" ? (
          <button
            type="button"
            disabled={submitting}
            onClick={onUpgrade}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-600 text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {t("profile.plan.upgrade")}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={onManage}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-600 text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {t("profile.plan.manage")}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push("/billing")}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {t("profile.credits.buyMore")}
        </button>
      </div>

      {/* History */}
      <div>
        <h3 className="text-lg font-medium mb-3 dark:text-zinc-100">{t("profile.credits.history")}</h3>

        {loadingHistory ? (
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <div className="animate-spin h-5 w-5 border-2 border-zinc-300 border-t-transparent rounded-full" />
            <span>{t("common.loading")}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-zinc-600 dark:text-zinc-400">{t("profile.credits.noHistory")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-600 dark:text-zinc-400">
                  <th className="pb-2 font-medium">{/* Date */}</th>
                  <th className="pb-2 font-medium">{/* Type */}</th>
                  <th className="pb-2 font-medium">{/* Amount */}</th>
                  <th className="pb-2 font-medium">{t("profile.credits.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const amount = it.delta;
                  const isPos = amount > 0;
                  const reasonKey = `profile.credits.reason.${it.reason}`;
                  return (
                    <tr key={it.id} className="border-t dark:border-zinc-800">
                      <td className="py-2 text-zinc-700 dark:text-zinc-300">
                        {new Date(it.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 text-zinc-700 dark:text-zinc-300">
                        {t(reasonKey as any)}
                      </td>
                      <td className={`py-2 font-medium ${isPos ? "text-green-600" : "text-red-600"}`}>
                        {isPos ? "+" : ""}
                        {amount.toLocaleString()} {t("credits.credits")}
                      </td>
                      <td className="py-2 text-zinc-700 dark:text-zinc-300">
                        {it.balance_after.toLocaleString()} {t("credits.credits")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls (icon-only for i18n compliance) */}
        {total > limit && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label={t("profile.credits.history")}
              disabled={!canPrev}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1 rounded border dark:border-zinc-700 disabled:opacity-40"
              title="Prev"
            >
              ←
            </button>
            <button
              type="button"
              aria-label={t("profile.credits.history")}
              disabled={!canNext}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1 rounded border dark:border-zinc-700 disabled:opacity-40"
              title="Next"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

