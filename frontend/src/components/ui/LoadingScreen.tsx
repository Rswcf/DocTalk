"use client";

import React from "react";
import { Spinner } from "../spell";

interface LoadingScreenProps {
  /** Optional label, defaults to a sr-only string for screen readers. */
  label?: string;
  /** Render full-page (min-h-screen + bg) vs inline. Default: full-page. */
  fullScreen?: boolean;
}

/**
 * Standardized loading state for full-page session/auth boots and similar
 * "we don't yet know what to render" moments. Replaces ad-hoc
 * `<div className="animate-pulse">Loading...</div>` patterns scattered across
 * pages — those were inconsistent and visually weak.
 *
 * Use <InlineSpinner> instead for in-card / mid-flow loading, where the
 * surrounding chrome already conveys context.
 */
export function LoadingScreen({
  label = "Loading",
  fullScreen = true,
}: LoadingScreenProps) {
  const wrapper = fullScreen
    ? "min-h-screen flex items-center justify-center bg-[var(--page-background)]"
    : "flex items-center justify-center py-16";

  return (
    <div className={wrapper} role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <Spinner variant="circle" size="sm" label={label} />
        <span aria-hidden="true">{label}</span>
      </div>
    </div>
  );
}
