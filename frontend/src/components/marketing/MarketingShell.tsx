"use client";

import EditorialMarketingHeader from "./EditorialMarketingHeader";
import type { Crumb } from "./EditorialMarketingHeader";
import EditorialFooter from "../landing/EditorialFooter";
import type { ChromeStrings } from "../../i18n/chrome";

export default function MarketingShell({
  breadcrumb,
  chrome,
  children,
}: {
  breadcrumb?: Crumb[];
  /**
   * Server-resolved chrome strings for localized pages. When provided, the
   * header/footer render translated nav/footer text in the initial HTML. When
   * omitted (not-yet-migrated pages), the chrome falls back to client `useLocale()`.
   */
  chrome?: ChromeStrings;
  children: React.ReactNode;
}) {
  return (
    <div className="dt-editorial min-h-screen flex flex-col">
      <EditorialMarketingHeader breadcrumb={breadcrumb} chrome={chrome} />
      <main className="flex-1">{children}</main>
      <EditorialFooter chrome={chrome} />
    </div>
  );
}
