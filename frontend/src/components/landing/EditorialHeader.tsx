"use client";

import EditorialHeaderBase from "../marketing/EditorialHeaderBase";

/**
 * Landing-page variant of the editorial masthead.
 * Adds the two-line mono dateline block ("STUDIO Nº 01" / "DOCUMENT INTELLIGENCE").
 * All shared markup lives in EditorialHeaderBase.
 */
export default function EditorialHeader() {
  return <EditorialHeaderBase showDateline />;
}
