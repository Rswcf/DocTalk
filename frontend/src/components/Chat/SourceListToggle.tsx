"use client";

import React from 'react';
import { useLocale } from '../../i18n';
import { SOURCE_PREVIEW_LIMIT } from '../../lib/sourceList';

interface SourceListToggleProps {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  /** id of the list this button expands, for aria-controls. */
  controls: string;
}

/** "Show all N sources" / "Show fewer" under a collapsed source list.
 *  Renders nothing when the list fits without collapsing. */
export default function SourceListToggle({ total, expanded, onToggle, controls }: SourceListToggleProps) {
  const { tOr } = useLocale();
  if (total <= SOURCE_PREVIEW_LIMIT) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className="inline-flex min-h-[32px] items-center rounded-md px-2 text-xs font-medium text-[#1D4ED8] transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] dark:text-[#60A5FA] dark:hover:bg-zinc-800"
    >
      {expanded
        ? tOr('chat.sources.showFewer', 'Show fewer')
        : tOr('chat.sources.showAll', 'Show all {count} sources', { count: total })}
    </button>
  );
}
