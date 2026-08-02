"use client";

import { useState } from 'react';
import { Check, Copy, MapPin, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../i18n';
import type { DocumentBiblioCsl, QuoteCard } from '../../lib/api';
import { formatApaInText } from '../../lib/apaFormat';
import { approxHighlightLabel, pageRangeLabel, tierLabel, trustLabel } from './utils';

interface QuoteResultCardProps {
  card: QuoteCard;
  index: number;
  biblio: DocumentBiblioCsl | null;
  onJump: (card: QuoteCard, index: number) => void;
}

export default function QuoteResultCard({ card, index, biblio, onJump }: QuoteResultCardProps) {
  const { tOr } = useLocale();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const apaInText = formatApaInText(biblio, card.page);
    const text = `"${card.displayText}" ${apaInText}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked in non-secure contexts / permission
      // denial — best-effort, no toast (the missing "Copied" state is
      // itself the "didn't work" cue, matching MessageBubble's copy button).
    }
  };

  return (
    <div className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldCheck size={12} aria-hidden="true" />
          {tOr('quoteFinder.verifiedBadge', 'Verified')}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {tierLabel(card.tier, tOr)}
        </span>
        <span className="text-[11px] text-[var(--reader-muted)]">{trustLabel(card.sourceKind, tOr)}</span>
      </div>

      <blockquote className="mt-2 border-l-2 border-blue-600 pl-3 text-sm italic leading-relaxed text-[var(--reader-ink)] dark:border-blue-400">
        &ldquo;{card.displayText}&rdquo;
      </blockquote>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[var(--reader-muted)]">
          <MapPin size={12} aria-hidden="true" />
          <span>{pageRangeLabel(card, tOr)}</span>
          <span aria-hidden="true">·</span>
          <span>{approxHighlightLabel(tOr)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onJump(card, index)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2.5 text-xs font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <MapPin size={12} aria-hidden="true" />
            {tOr('quoteFinder.jump', 'Jump to page')}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2.5 text-xs font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            {copied ? tOr('quoteFinder.copied', 'Copied') : tOr('quoteFinder.copy', 'Copy quote + citation')}
          </button>
        </div>
      </div>
    </div>
  );
}
