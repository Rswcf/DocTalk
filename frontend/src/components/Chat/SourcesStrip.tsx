"use client";

import React from "react";
import { FileText } from "lucide-react";
import type { Citation } from "../../types";
import { useLocale } from "../../i18n";
import { useDocTalkStore } from "../../store";

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
  const currentDocumentName = useDocTalkStore((s) => s.documentName);

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
        className="dt-sources-strip mb-3 flex flex-col gap-2"
        aria-label={tOr("chat.sources.retrievingAriaLabel", "Retrieving sources")}
        role="status"
      >
        <div
          className="dt-sources-label text-[11px] uppercase"
          style={{
            fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
            letterSpacing: '0.10em',
          }}
        >
          {tOr("chat.sources.retrieving", "Retrieving sources…")}
        </div>
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-7 w-36 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-panel-solid)] animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    );
  }

  const label = t("chat.sources.label", { count: unique.length });

  return (
    <section
      className="dt-sources-strip mb-3 flex flex-col gap-2"
      aria-label={tOr("chat.sources.ariaLabel", "Answer sources")}
    >
      <div className="dt-sources-label text-[11px] font-mono uppercase">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {unique.map((c) => {
          const filename = c.documentFilename || currentDocumentName || "Document";
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
              className="dt-source-chip group inline-flex max-w-xs items-center gap-2 rounded-md px-2.5 py-1.5 text-xs motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <span className="dt-source-index inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-bold leading-none">
                {c.refIndex}
              </span>
              <FileText
                aria-hidden="true"
                size={12}
                className="shrink-0 text-zinc-400 group-hover:text-[var(--reader-evidence)] dark:text-zinc-500"
              />
              <span className="truncate font-medium">{displayFilename}</span>
              <span
                className="shrink-0 text-[10px] text-[var(--reader-muted)]"
                style={{ fontFamily: 'var(--font-plex-mono), ui-monospace, monospace' }}
              >
                p.{c.page}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
