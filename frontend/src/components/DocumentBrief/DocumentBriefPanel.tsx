"use client";

import React, { useMemo } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  RefreshCcw,
  Rows3,
  Sparkles,
} from "lucide-react";
import { useLocale } from "../../i18n";
import { useDocumentBrief } from "../../lib/useDocumentBrief";
import { trackEvent } from "../../lib/analytics";
import type {
  Citation,
  DocumentBriefFact,
  DocumentBriefKeyPoint,
  DocumentBriefOutlineItem,
  DocumentBriefSourceRef,
  NormalizedBBox,
} from "../../types";

interface DocumentBriefPanelProps {
  documentId: string;
  onCitationClick: (citation: Citation) => void;
}

function validBboxes(value: DocumentBriefSourceRef["bboxes"]): NormalizedBBox[] {
  if (!Array.isArray(value)) return [];
  return value.filter((bb): bb is NormalizedBBox => {
    if (!bb || typeof bb !== "object") return false;
    return ["x", "y", "w", "h"].every((key) => typeof bb[key as keyof NormalizedBBox] === "number");
  });
}

function toCitation(ref: DocumentBriefSourceRef, refIndex: number): Citation {
  return {
    refIndex,
    chunkId: ref.chunk_id,
    page: ref.page,
    pageEnd: typeof ref.page_end === "number" ? ref.page_end : undefined,
    bboxes: validBboxes(ref.bboxes),
    textSnippet: ref.text_snippet || "",
    offset: 0,
  };
}

function uniqueRefs(refs: DocumentBriefSourceRef[]): DocumentBriefSourceRef[] {
  const seen = new Set<string>();
  const out: DocumentBriefSourceRef[] = [];
  for (const ref of refs || []) {
    const key = ref.chunk_id || `${ref.page}-${ref.text_snippet}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function SourceRefs({
  refs,
  onCitationClick,
}: {
  refs: DocumentBriefSourceRef[];
  onCitationClick: (citation: Citation) => void;
}) {
  const { tOr } = useLocale();
  const sourceRefs = uniqueRefs(refs);
  if (sourceRefs.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap gap-1.5 align-middle">
      {sourceRefs.map((ref, index) => {
        const citation = toCitation(ref, index + 1);
        const pageLabel = ref.page_end && ref.page_end !== ref.page
          ? `p.${ref.page}-${ref.page_end}`
          : `p.${ref.page}`;
        return (
          <button
            key={`${ref.chunk_id}-${index}`}
            type="button"
            onClick={() => onCitationClick(citation)}
            title={tOr("citation.jumpTo", "Jump to page {page}", { page: ref.page })}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2 text-[11px] font-medium text-[var(--reader-evidence)] transition-colors hover:border-[var(--reader-evidence)] focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            <FileText size={12} aria-hidden="true" />
            <span className="font-mono">{pageLabel}</span>
          </button>
        );
      })}
    </span>
  );
}

function formatDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-24 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] animate-pulse motion-reduce:animate-none" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="space-y-2 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-4">
          <div className="h-4 w-2/5 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export default function DocumentBriefPanel({ documentId, onCitationClick }: DocumentBriefPanelProps) {
  const { tOr, locale } = useLocale();
  const { brief, loading, error, refresh } = useDocumentBrief(documentId);
  const generatedAt = formatDate(brief?.generated_at || brief?.updated_at, locale);

  const hasStructuredContent = Boolean(
    brief?.summary ||
    brief?.outline?.length ||
    brief?.key_points?.length ||
    brief?.facts?.length ||
    brief?.questions?.length
  );
  const selectedChunks = useMemo(() => {
    const raw = brief?.coverage?.selected_chunk_ids;
    return Array.isArray(raw) ? raw.length : 0;
  }, [brief?.coverage]);

  const handleCitationClick = (citation: Citation) => {
    trackEvent("citation_clicked", {
      source: "document_brief",
      page: citation.page,
      has_bboxes: Boolean(citation.bboxes?.length),
    });
    onCitationClick(citation);
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--reader-panel-solid)] text-[var(--reader-ink)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-5 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-[var(--reader-border)] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--reader-muted)]">
                <BookOpen size={14} aria-hidden="true" />
                {tOr("brief.kicker", "Document brief")}
              </div>
              <h2 className="text-xl font-semibold leading-tight">
                {tOr("brief.title", "Read the document structure first")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:border-[var(--reader-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <RefreshCcw size={15} aria-hidden="true" />
              {tOr("brief.refresh", "Refresh")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-[var(--reader-muted)]">
            {generatedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--reader-border)] px-2.5 py-1">
                <CalendarClock size={13} aria-hidden="true" />
                {tOr("brief.generatedAt", "Generated {time}", { time: generatedAt })}
              </span>
            ) : null}
            {brief?.status ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--reader-border)] px-2.5 py-1">
                {brief.status === "ready" ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
                {tOr("brief.status", "Status: {status}", { status: brief.status })}
              </span>
            ) : null}
            {selectedChunks > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--reader-border)] px-2.5 py-1">
                <Rows3 size={13} aria-hidden="true" />
                {tOr("brief.coverage", "{count} representative sources", { count: selectedChunks })}
              </span>
            ) : null}
          </div>
        </header>

        {loading && !brief ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={16} aria-hidden="true" />
              {tOr("brief.errorTitle", "Brief unavailable")}
            </div>
            <p className="mt-1">{error}</p>
          </div>
        ) : brief?.status === "failed" ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={16} aria-hidden="true" />
              {tOr("brief.failed", "Brief generation failed")}
            </div>
            <p className="mt-1">{brief.error_message || tOr("brief.failedHint", "You can still use chat while we retry generation on the next parse.")}</p>
          </div>
        ) : !hasStructuredContent ? (
          <div className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-4 py-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 size={16} className="text-[var(--reader-evidence)]" aria-hidden="true" />
              {tOr("brief.preparingTitle", "Preparing the brief")}
            </div>
            <p className="mt-2 text-sm text-[var(--reader-muted)]">
              {tOr("brief.preparingBody", "DocTalk is building a representative map of this document. Chat is available while the brief is prepared.")}
            </p>
          </div>
        ) : (
          <>
            {brief?.summary ? (
              <section className="rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles size={16} className="text-[var(--reader-evidence)]" aria-hidden="true" />
                  {tOr("brief.summary", "Summary")}
                </div>
                <p className="text-sm leading-7 text-[var(--reader-ink)]">{brief.summary}</p>
              </section>
            ) : null}

            {brief?.outline?.length ? (
              <Section title={tOr("brief.outline", "Outline")} icon={<BookOpen size={16} aria-hidden="true" />}>
                <div className="space-y-3">
                  {brief.outline.map((item: DocumentBriefOutlineItem, index: number) => (
                    <article key={`${item.title}-${index}`} className="border-l-2 border-[var(--reader-evidence-border)] pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                        <SourceRefs refs={item.source_refs} onCitationClick={handleCitationClick} />
                      </div>
                      {item.summary ? <p className="mt-1 text-sm leading-6 text-[var(--reader-muted)]">{item.summary}</p> : null}
                    </article>
                  ))}
                </div>
              </Section>
            ) : null}

            {brief?.key_points?.length ? (
              <Section title={tOr("brief.keyPoints", "Key points")} icon={<ListChecks size={16} aria-hidden="true" />}>
                <ol className="space-y-3">
                  {brief.key_points.map((item: DocumentBriefKeyPoint, index: number) => (
                    <li key={`${item.text}-${index}`} className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--reader-panel-muted)] font-mono text-xs text-[var(--reader-muted)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6">{item.text}</p>
                        <div className="mt-1">
                          <SourceRefs refs={item.source_refs} onCitationClick={handleCitationClick} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            ) : null}

            {brief?.facts?.length ? (
              <Section title={tOr("brief.facts", "Facts and figures")} icon={<Rows3 size={16} aria-hidden="true" />}>
                <div className="overflow-hidden rounded-lg border border-[var(--reader-border)]">
                  {brief.facts.map((item: DocumentBriefFact, index: number) => (
                    <div key={`${item.label}-${index}`} className="grid gap-2 border-b border-[var(--reader-border)] p-3 last:border-b-0 sm:grid-cols-[minmax(8rem,14rem)_1fr]">
                      <div>
                        <div className="text-xs font-medium uppercase text-[var(--reader-muted)]">{item.label}</div>
                        <div className="mt-1 text-sm font-semibold">{item.value}</div>
                      </div>
                      <div className="text-sm leading-6 text-[var(--reader-muted)]">
                        {item.context ? <p>{item.context}</p> : null}
                        <div className={item.context ? "mt-1" : ""}>
                          <SourceRefs refs={item.source_refs} onCitationClick={handleCitationClick} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {brief?.questions?.length ? (
              <Section title={tOr("brief.questions", "Suggested questions")} icon={<ListChecks size={16} aria-hidden="true" />}>
                <div className="flex flex-wrap gap-2">
                  {brief.questions.map((question: string, index: number) => (
                    <span key={`${question}-${index}`} className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 py-2 text-sm text-[var(--reader-muted)]">
                      {question}
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--reader-ink)]">
        <span className="text-[var(--reader-evidence)]">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}
