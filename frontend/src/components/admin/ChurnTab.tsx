"use client";

import type { AdminChurn } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";
import ChurnSignalsBars from "./ChurnSignalsBars";
import FeedbackList from "./FeedbackList";
import ReasonBucketsDonut from "./ReasonBucketsDonut";

export default function ChurnTab({ churn }: { churn: AdminChurn | null }) {
  const { tOr } = useLocale();
  if (!churn) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label={tOr("admin.churn.churnedUsers", "Churned users")} value={churn.churned_users} />
        <Metric label={tOr("admin.churn.oneAndDone", "One and done")} value={formatPercent(churn.one_and_done.pct)} detail={tOr("admin.churn.oneAndDoneDetail", "{count} of {total}", { count: churn.one_and_done.count, total: churn.one_and_done.activated_users })} />
        <Metric label={tOr("admin.churn.inactiveWindow", "Inactive window")} value={`${churn.inactive_days}d`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ChurnSignalsBars signals={churn.churn_signals} />
        <ReasonBucketsDonut buckets={churn.reason_buckets} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="dt-admin-panel rounded-lg border">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {tOr("admin.churn.lastAction", "Last Action")}
            </h2>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {churn.last_action.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.churn.noLastAction", "No last-action data yet.")}</p>
            ) : churn.last_action.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.label}</span>
                <span className="text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
                  {formatNumber(item.count)} / {formatPercent(item.pct)}
                </span>
              </div>
            ))}
          </div>
        </section>
        <FeedbackList feedback={churn.feedback.recent} />
      </div>
      <section className="dt-admin-panel rounded-lg border">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {tOr("admin.churn.cancelReasons", "Cancel Reasons")}
          </h2>
        </div>
        {churn.cancel_reasons.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.churn.noCancelReasons", "No cancel reasons in this window.")}</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {churn.cancel_reasons.map((reason) => (
              <div key={reason.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{reason.from_plan} -&gt; {reason.to_plan}</span>
                  {reason.created_at ? <time>{new Date(reason.created_at).toLocaleDateString()}</time> : null}
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {reason.reason || tOr("admin.churn.unspecifiedReason", "Unspecified reason")}
                </p>
                {reason.feedback ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{reason.feedback}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className="dt-admin-panel rounded-lg border p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {detail ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p> : null}
    </div>
  );
}
