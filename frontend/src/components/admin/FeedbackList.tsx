"use client";

import type { AdminChurnFeedbackItem } from "../../lib/api";
import { useLocale } from "../../i18n";

export default function FeedbackList({ feedback }: { feedback: AdminChurnFeedbackItem[] }) {
  const { tOr } = useLocale();

  return (
    <section className="dt-admin-panel rounded-lg border">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {tOr("admin.churn.feedbackTitle", "Recent Feedback")}
        </h2>
      </div>
      {feedback.length === 0 ? (
        <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
          {tOr("admin.churn.noFeedback", "No recent feedback.")}
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {feedback.slice(0, 8).map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {item.area}
                </span>
                <span>{item.type}</span>
                <span>{item.severity}</span>
                {item.plan ? <span>{item.plan}</span> : null}
                {item.created_at ? <time>{new Date(item.created_at).toLocaleDateString()}</time> : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {item.message || tOr("admin.churn.feedbackNoMessage", "No written detail.")}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
