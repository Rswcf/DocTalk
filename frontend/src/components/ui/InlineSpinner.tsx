"use client";

import React from "react";

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
  const dim = size === "sm" ? "h-4 w-4 border-[1.5px]" : "h-6 w-6 border-2";
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`inline-block ${dim} rounded-full border-zinc-300 border-t-transparent animate-spin motion-reduce:animate-none dark:border-zinc-600 dark:border-t-transparent`}
      />
      <span className={hideLabel ? "sr-only" : ""}>{label}</span>
    </span>
  );
}
