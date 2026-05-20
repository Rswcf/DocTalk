"use client";

import EditorialHeaderBase from "./EditorialHeaderBase";
import type { Crumb } from "./EditorialHeaderBase";

// Re-export Crumb so existing consumers (`MarketingShell`) keep working.
export type { Crumb };

interface EditorialMarketingHeaderProps {
  breadcrumb?: Crumb[];
}

/**
 * Inner-page variant of the editorial masthead.
 * Adds the breadcrumb row below the masthead.
 * All shared markup lives in EditorialHeaderBase.
 */
export default function EditorialMarketingHeader({
  breadcrumb,
}: EditorialMarketingHeaderProps) {
  return <EditorialHeaderBase breadcrumb={breadcrumb} />;
}
