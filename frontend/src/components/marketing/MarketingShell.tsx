"use client";

import EditorialMarketingHeader from "./EditorialMarketingHeader";
import type { Crumb } from "./EditorialMarketingHeader";
import EditorialFooter from "../landing/EditorialFooter";
import type { ChromeStrings } from "../../i18n/chrome";
import { NIGHT_ROOT_CLASS, useNightDocument } from "./night";

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
  // Night on every marketing page (owner, 2026-09-21), the same theme as the
  // landing: see ./night.ts.
  useNightDocument();
  return (
    <div className={`${NIGHT_ROOT_CLASS} min-h-screen flex flex-col`}>
      <EditorialMarketingHeader breadcrumb={breadcrumb} chrome={chrome} />
      <main className="flex-1">{children}</main>
      <EditorialFooter chrome={chrome} />
    </div>
  );
}
