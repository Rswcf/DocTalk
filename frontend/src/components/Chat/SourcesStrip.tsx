"use client";

import { citationPageRange, citationPreview, citationSourceKey } from '../../lib/citationText';
import { shortSnippet, showsDocumentNames, visibleSources } from '../../lib/sourceList';
import SourceListToggle from './SourceListToggle';
import React from "react";
import { FileText } from "lucide-react";
import type { Citation } from "../../types";
import { useLocale } from "../../i18n";
import { useDocTalkStore } from "../../store";

interface SourcesStripProps {
  citations: Citation[];
  /** The message these sources belong to: marks the chip of the citation the
   *  reader is showing (citationTarget) and keeps it visible when collapsed. */
  messageId?: string;
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
 * Deduplicates identical source locations while retaining distinct page targets,
 * orders chips by their [n] number, and shows the first few until expanded.
 * Chips name the file only when the answer cites more than one document; in a
 * single-document reader they show the cited excerpt instead.
 *
 * Click forwards to the same onCitationClick the inline pills use, so
 * behaviour is identical — PdfViewer scrolls + highlight flashes.
 */
export default function SourcesStrip({
  citations,
  messageId,
  onCitationClick,
  isStreaming = false,
}: SourcesStripProps) {
  const { t, tOr } = useLocale();
  const currentDocumentName = useDocTalkStore((s) => s.documentName);
  const activeCitation = useDocTalkStore((s) =>
    messageId && s.citationTarget?.messageId === messageId ? s.citationTarget.citation : null,
  );
  const [expanded, setExpanded] = React.useState(false);
  const listId = React.useId();

  // Preserve distinct page targets within the same cross-page chunk.
  const unique = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const c of citations) {
      const key = citationSourceKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    // Stable sort: chips arrive in stream order, which is not [n] order once a
    // later claim re-cites an earlier source.
    return out.sort((a, b) => a.refIndex - b.refIndex);
  }, [citations]);
  const multiDocument = React.useMemo(() => showsDocumentNames(unique), [unique]);
  const isActive = (c: Citation) =>
    Boolean(activeCitation) && activeCitation!.chunkId === c.chunkId && activeCitation!.refIndex === c.refIndex;

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
        <div className="dt-sources-label text-xs font-medium">
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
      <div className="dt-sources-label text-xs font-medium">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-2" id={listId}>
        {visibleSources(unique, expanded, isActive).map((c) => {
          const filename = c.documentFilename || currentDocumentName || "Document";
          const displayFilename = multiDocument
            ? shortSnippet(filename, 20)
            : shortSnippet(citationPreview(c)) || tOr("citation.passageFallback", "Cited passage");
          const jumpLabel = t("citation.jumpTo", { page: citationPageRange(c) });
          return (
            <button
              key={citationSourceKey(c)}
              type="button"
              onClick={() => onCitationClick?.(c)}
              aria-current={isActive(c) ? "location" : undefined}
              title={jumpLabel}
              // No aria-label: the visible text ("12", the excerpt or file
              // name, "Page 5") is the accessible name, so each chip is
              // distinct and a voice user can say what they see (WCAG 2.5.3;
              // review 2026-11-23 F3). The jump target is its description.
              aria-describedby={`${listId}-jump-${c.refIndex}`}
              className="dt-source-chip group inline-flex max-w-xs items-center gap-2 rounded-md px-2.5 py-1.5 text-xs motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <span className="dt-source-index inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs font-bold leading-none tabular-nums">
                {c.refIndex}
              </span>
              <FileText
                aria-hidden="true"
                size={12}
                className="shrink-0 text-zinc-400 group-hover:text-[var(--reader-evidence)] dark:text-zinc-500"
              />
              <span dir="auto" className={`truncate ${multiDocument ? 'font-medium' : 'text-[var(--reader-muted)]'}`}>{displayFilename}</span>
              <span id={`${listId}-jump-${c.refIndex}`} className="sr-only">{jumpLabel}</span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--reader-muted)]">
                {t('citation.page', { page: citationPageRange(c) })}
              </span>
            </button>
          );
        })}
        <SourceListToggle
          total={unique.length}
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
          controls={listId}
        />
      </div>
    </section>
  );
}
