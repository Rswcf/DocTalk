"use client";

import React from "react";
import { FileText } from "lucide-react";
import type { Citation } from "../../types";
import { useLocale } from "../../i18n";

interface SourcesStripProps {
  citations: Citation[];
  onCitationClick?: (c: Citation) => void;
}

/**
 * Horizontal strip of deduplicated source chips, rendered at the top of an
 * assistant message. Perplexity-style "sources before answer" pattern —
 * makes DocTalk's citation-grounded promise visible at a glance instead of
 * scattering numeric [1][2] pills through prose.
 *
 * Deduplicates by (documentId, page) so a chunk cited 3 times in one answer
 * still renders as one chip. refIndex of the first occurrence is shown.
 *
 * Click handler forwards to the same onCitationClick used by inline pills,
 * so behaviour is identical to clicking [1] — PdfViewer scrolls and the
 * highlight flashes.
 */
export default function SourcesStrip({
  citations,
  onCitationClick,
}: SourcesStripProps) {
  const { t, tOr } = useLocale();

  // Dedupe by docId+page while preserving the order the LLM surfaced them.
  const unique = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const c of citations) {
      const key = `${c.documentId ?? "_"}::${c.page}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [citations]);

  if (unique.length === 0) return null;

  const label = t("chat.sources.label", { count: unique.length });

  return (
    <div
      className="mb-3 flex flex-col gap-2"
      aria-label={tOr("chat.sources.ariaLabel", "Answer sources")}
    >
      <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {unique.map((c) => {
          const filename = c.documentFilename ?? "Document";
          const displayFilename =
            filename.length > 22 ? filename.slice(0, 20) + "…" : filename;
          return (
            <button
              key={`${c.documentId ?? "_"}-${c.page}-${c.refIndex}`}
              type="button"
              onClick={() => onCitationClick?.(c)}
              title={t("citation.jumpTo", { page: c.page })}
              className="group inline-flex items-center gap-2 max-w-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 shadow-sm transition-colors motion-reduce:transition-none hover:border-accent hover:bg-accent/5 dark:hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-accent text-[10px] font-bold leading-none text-accent-foreground">
                {c.refIndex}
              </span>
              <FileText
                aria-hidden="true"
                size={12}
                className="shrink-0 text-zinc-400 dark:text-zinc-500 group-hover:text-accent"
              />
              <span className="truncate font-medium">{displayFilename}</span>
              <span className="shrink-0 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                p.{c.page}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
