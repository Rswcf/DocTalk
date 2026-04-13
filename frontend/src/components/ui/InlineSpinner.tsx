"use client";

import React from "react";
import { Spinner } from "../spell";

interface InlineSpinnerProps {
  size?: "sm" | "md";
  label?: string;
  /** Hide the textual label visually; still announced by screen readers. */
  hideLabel?: boolean;
  className?: string;
}

/**
 * Small inline spinner for mid-flow loading inside an existing layout
 * (sidebar fetch, form submit, table refresh). For full-page bootstraps
 * use <LoadingScreen> instead.
 */
export function InlineSpinner({
  size = "md",
  label = "Loading",
  hideLabel = false,
  className = "",
}: InlineSpinnerProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spinner variant="circle" size={size} label={label} />
      <span className={hideLabel ? "sr-only" : ""}>{label}</span>
    </span>
  );
}
