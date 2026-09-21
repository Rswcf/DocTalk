"use client";

import EditorialHeaderBase from "../marketing/EditorialHeaderBase";

/**
 * Landing-page masthead.
 *
 * It used to pass `showDateline`, which added a two-line mono block beside the
 * wordmark: a hardcoded "STUDIO Nº 01" and the tagline forced to uppercase.
 * Retired with the hero collage (plan 2026-09-20 §5.6) — it was magazine
 * set-dressing that told a visitor nothing. The prop and its markup remain in
 * EditorialHeaderBase for now, unused; Phase 5 deletes them.
 */
export default function EditorialHeader() {
  return <EditorialHeaderBase />;
}
