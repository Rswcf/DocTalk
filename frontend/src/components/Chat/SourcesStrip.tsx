"use client";

import React from "react";
import { FileText } from "lucide-react";
import type { Citation } from "../../types";
import { useLocale } from "../../i18n";

interface SourcesStripProps {
  citations: Citation[];
  onCitationClick?: (c: Citation) => void;
  /** True while the assistant reply is still streaming. If no citations
   *  have arrived yet but streaming is active, render a placeholder skeleton
   *  so the "sources will appear above the answer" framing is visible
   *  from the first token, not just after the first [n] is emitted. */
  isStreaming?: boolean;
}

/**
 * Horizontal strip of source chips, rendered at the top of an assistant
 * message. Makes DocTalk's citation-grounded promise visible at a glance
 * instead of scattering numeric [1][2] pills through prose.
 *
 * Backend currently emits each Citation inline as the corresponding `[n]`
 * token appears in the stream (see chat_service.py). So chips populate
 * progressively ABOVE the answer as it streams — a step toward the full
 * Perplexity "sources-before-tokens" pattern, which would need a new
 * chunks_retrieved SSE event and is explicitly out of scope here.
 *
 * Deduplicates by chunkId (guaranteed unique, present on every Citation)
 * so a chunk cited multiple times renders as one chip. The refIndex of
 * the first occurrence is shown. Earlier (docId, page) key was broken on
 * multi-doc Collections because docId falls back to "_" for the
 * single-doc path, which then collapses cross-doc same-page citations.
 *
 * Click forwards to the same onCitationClick the inline pills use, so
 * behaviour is identical — PdfViewer scrolls + highlight flashes.
 */
export default function SourcesStrip({
  citations,
  onCitationClick,
  isStreaming = false,
}: SourcesStripProps) {
  const { t, tOr } = useLocale();

  // Dedupe by chunkId (stable per chunk) while preserving LLM order.
  const unique = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const c of citations) {
      if (seen.has(c.chunkId)) continue;
      seen.add(c.chunkId);
      out.push(c);
    }
    return out;
  }, [citations]);

  // Streaming with no citations yet: render a skeleton placeholder so the
  // user sees "sources are coming" rather than a blank space that later
  // shifts layout when the first chip arrives.
  if (unique.length === 0) {
    if (!isStreaming) return null;
    return (
      <div
        className="mb-3 flex flex-col gap-2"
        aria-label={tOr("chat.sources.retrievingAriaLabel", "Retrieving sources")}
        role="status"
      >
        <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {tOr("chat.sources.retrieving", "Retrieving sources…")}
        </div>
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-7 w-36 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    );
  }

  const label = t("chat.sources.label", { count: unique.length });

  return (
    <section
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
          const jumpLabel = t("citation.jumpTo", { page: c.page });
          return (
            <button
              key={c.chunkId}
              type="button"
              onClick={() => onCitationClick?.(c)}
              title={jumpLabel}
              aria-label={`${filename} — ${jumpLabel}`}
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
    </section>
  );
}
