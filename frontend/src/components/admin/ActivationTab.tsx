"use client";

import type { AdminFunnel, AdminUserActivity } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatNumber";
import { useLocale } from "../../i18n";
import { FunnelPanel } from "./AdminPanels";

export default function ActivationTab({
  activity,
  funnel,
}: {
  activity: AdminUserActivity | null;
  funnel: AdminFunnel | null;
}) {
  const { tOr } = useLocale();
  const stages = (activity?.funnel || []).slice(0, 5);
  const signupUsers = stages[0]?.users || 0;

  return (
    <div className="space-y-6">
      <section className="dt-admin-panel rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {tOr("admin.activation.title", "Activation Funnel")}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {tOr("admin.activation.subtitle", "Signup to upload, first chat, and engaged usage.")}
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {stages.map((stage, index) => {
            const dropoff = index > 0 && stages[index - 1]?.users
              ? 1 - stage.users / stages[index - 1].users
              : null;
            return (
              <div key={stage.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{stage.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                  {formatNumber(stage.users)}
                </p>
                <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {index === 0
                    ? tOr("admin.activation.start", "Start")
                    : tOr("admin.activation.ofSignups", "{rate} of signups", {
                        rate: formatPercent(signupUsers > 0 ? stage.users / signupUsers : 0),
                      })}
                </p>
                {dropoff != null ? (
                  <p className="mt-1 text-xs tabular-nums text-red-600 dark:text-red-300">
                    {tOr("admin.activation.dropoff", "{rate} drop-off", { rate: formatPercent(dropoff) })}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      <FunnelPanel funnel={funnel} title={tOr("admin.activation.extendedFunnel", "Extended Signup Funnel")} />
    </div>
  );
}
