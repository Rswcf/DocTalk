"use client";

import type { AdminBillingHealth, AdminFunnel } from "../../lib/api";
import { useLocale } from "../../i18n";
import { BillingHealthPanel, FunnelPanel } from "./AdminPanels";

export default function RevenueTab({
  funnel,
  billingHealth,
  billingRemoteLoading,
  onRemoteCheck,
}: {
  funnel: AdminFunnel | null;
  billingHealth: AdminBillingHealth | null;
  billingRemoteLoading: boolean;
  onRemoteCheck: () => void;
}) {
  const { tOr } = useLocale();

  return (
    <div className="space-y-6">
      <FunnelPanel funnel={funnel} title={tOr("admin.revenue.funnelTitle", "Revenue Funnel")} />
      <BillingHealthPanel
        health={billingHealth}
        loadingRemote={billingRemoteLoading}
        onRemoteCheck={onRemoteCheck}
      />
    </div>
  );
}
