"use client";

import EditorialMarketingHeader from "./EditorialMarketingHeader";
import type { Crumb } from "./EditorialMarketingHeader";
import EditorialFooter from "../landing/EditorialFooter";

export default function MarketingShell({
  breadcrumb,
  children,
}: {
  breadcrumb?: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <div className="dt-editorial min-h-screen flex flex-col">
      <EditorialMarketingHeader breadcrumb={breadcrumb} />
      <main className="flex-1">{children}</main>
      <EditorialFooter />
    </div>
  );
}
