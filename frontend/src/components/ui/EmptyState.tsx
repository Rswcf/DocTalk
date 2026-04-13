"use client";

import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Tighter vertical padding for in-card / in-section uses. */
  compact?: boolean;
}

/**
 * Standardized empty state. Use for "no documents yet", "no search results",
 * "no history", etc. Always pair an empty state with an actionable next step
 * (CTA) so the user is not stuck staring at a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const action = actionLabel && (actionHref || onAction);

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-10" : "py-16"
      }`}
      role="status"
    >
      {Icon && (
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Icon
            aria-hidden="true"
            size={22}
            className="text-zinc-500 dark:text-zinc-300"
          />
        </div>
      )}
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-[box-shadow,background-color] motion-reduce:transition-none hover:bg-accent-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-[box-shadow,background-color] motion-reduce:transition-none hover:bg-accent-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
