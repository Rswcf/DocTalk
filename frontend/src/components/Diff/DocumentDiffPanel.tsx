"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  GitCompare,
  Play,
} from "lucide-react";
import {
  ApiError,
  exportDocumentDiffRun,
  getDocumentDiffRun,
  getMyDocuments,
  listDocumentDiffRuns,
  runDocumentDiff,
} from "../../lib/api";
import type { DocumentBrief } from "../../lib/api";
import { trackEvent } from "../../lib/analytics";
import { billingHref } from "../../lib/billingLinks";
import { useLocale } from "../../i18n";
import type { Citation, ExtractionJob, NormalizedBBox } from "../../types";

type DiffDocument = {
  id: string;
  filename: string;
  status?: string;
};

type DiffChange = {
  kind: "added" | "removed" | "modified";
  title: string;
  detail: string;
  old_refs: number[];
  new_refs: number[];
};

interface DocumentDiffPanelProps {
  collectionId?: string;
  documents?: DiffDocument[];
  onCitationClick?: (citation: Citation) => void;
  userPlan?: string;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
}

function filenameFromScope(scope: Record<string, unknown>, key: string): string {
  const value = scope[key];
  return typeof value === "string" && value.trim() ? value : "";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCitation(raw: Record<string, unknown>): Citation | null {
  const refIndex = Number(raw.ref_index);
  const page = Number(raw.page);
  const chunkId = typeof raw.chunk_id === "string" ? raw.chunk_id : "";
  if (!refIndex || !page || !chunkId) return null;
  const rawBboxes = Array.isArray(raw.bboxes) ? raw.bboxes : [];
  const bboxes = rawBboxes.filter((bb): bb is NormalizedBBox => {
    if (!bb || typeof bb !== "object") return false;
    const rec = bb as Record<string, unknown>;
    return ["x", "y", "w", "h"].every((key) => typeof rec[key] === "number");
  });
  return {
    refIndex,
    chunkId,
    page,
    pageEnd: typeof raw.page_end === "number" ? raw.page_end : undefined,
    bboxes,
    textSnippet: typeof raw.text_snippet === "string" ? raw.text_snippet : "",
    offset: 0,
    documentId: typeof raw.document_id === "string" ? raw.document_id : undefined,
    documentFilename: typeof raw.document_filename === "string" ? raw.document_filename : undefined,
    confidenceScore: typeof raw.confidence_score === "number" ? raw.confidence_score : undefined,
    contextText: typeof raw.context_text === "string" ? raw.context_text : undefined,
  };
}

function groupChanges(changes: DiffChange[], kind: DiffChange["kind"]): DiffChange[] {
  return changes.filter((change) => change.kind === kind);
}

export default function DocumentDiffPanel({
  collectionId,
  documents,
  onCitationClick,
  userPlan,
}: DocumentDiffPanelProps) {
  const { tOr, locale } = useLocale();
  const [availableDocs, setAvailableDocs] = useState<DiffDocument[]>(documents || []);
  const [runs, setRuns] = useState<ExtractionJob[]>([]);
  const [oldDocumentId, setOldDocumentId] = useState("");
  const [newDocumentId, setNewDocumentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ code: string; requiredPlan: string } | null>(null);

  const readyDocs = useMemo(
    () => availableDocs.filter((doc) => (doc.status || "ready").toLowerCase() === "ready"),
    [availableDocs]
  );

  const refreshRuns = useCallback(async () => {
    const data = await listDocumentDiffRuns(collectionId);
    setRuns(data);
    return data;
  }, [collectionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const docsPromise = documents
      ? Promise.resolve(documents)
      : getMyDocuments().then((items: DocumentBrief[]) => items.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          status: doc.status,
        })));

    Promise.all([docsPromise, refreshRuns()])
      .then(([docs]) => {
        if (cancelled) return;
        setAvailableDocs(docs);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load comparisons");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documents, refreshRuns]);

  useEffect(() => {
    if (oldDocumentId && newDocumentId) return;
    if (readyDocs.length < 2) return;
    setOldDocumentId((current) => current || readyDocs[0].id);
    setNewDocumentId((current) => current || readyDocs[1].id);
  }, [newDocumentId, oldDocumentId, readyDocs]);

  useEffect(() => {
    if (!runs.some((run) => run.status === "queued" || run.status === "running")) return;
    const timer = window.setInterval(() => {
      void refreshRuns().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refreshRuns, runs]);

  const activeRun = runs[0] || null;
  const result = activeRun?.result?.structured_json || {};
  const changes: DiffChange[] = asArray(result.changes).map((item) => ({
    kind: item.kind === "added" || item.kind === "removed" || item.kind === "modified" ? item.kind : "modified",
    title: asString(item.title),
    detail: asString(item.detail),
    old_refs: asNumberArray(item.old_refs),
    new_refs: asNumberArray(item.new_refs),
  }));
  const citations = asArray(activeRun?.result?.citations);
  const citationByLabel = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const citation of citations) {
      const label = typeof citation.label === "string" ? citation.label : "";
      if (label) map.set(label, citation);
    }
    return map;
  }, [citations]);
  const oldName = filenameFromScope(activeRun?.input_scope || {}, "old_document_filename");
  const newName = filenameFromScope(activeRun?.input_scope || {}, "new_document_filename");
  const isWorking = running || activeRun?.status === "queued" || activeRun?.status === "running";

  const handleCitation = useCallback((raw: Record<string, unknown>) => {
    const citation = toCitation(raw);
    if (!citation) return;
    trackEvent("citation_clicked", {
      source: collectionId ? "collection_reader" : "compare_page",
      reason: "document_diff",
      page: citation.page,
      has_bboxes: Boolean(citation.bboxes?.length),
    });
    if (onCitationClick) {
      onCitationClick(citation);
      return;
    }
    if (!citation.documentId) return;
    const params = new URLSearchParams({ page: String(citation.page || 1) });
    if (citation.chunkId) params.set("highlight", citation.chunkId);
    window.open(`/d/${citation.documentId}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }, [collectionId, onCitationClick]);

  const runCompare = useCallback(async () => {
    if (!oldDocumentId || !newDocumentId || oldDocumentId === newDocumentId || running) return;
    setRunning(true);
    setError(null);
    setPaywall(null);
    try {
      const job = await runDocumentDiff({
        oldDocumentId,
        newDocumentId,
        collectionId,
        locale,
      });
      setRuns((prev) => [job, ...prev.filter((item) => item.id !== job.id)]);
      trackEvent("document_diff_created", {
        source: collectionId ? "collection_reader" : "compare_page",
        reason: "document_diff",
        plan: userPlan,
      });
      window.setTimeout(() => {
        void getDocumentDiffRun(job.id)
          .then((updated) => setRuns((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)]))
          .catch(() => undefined);
      }, 1200);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "PLAN_REQUIRED" || err.code === "INSUFFICIENT_CREDITS")) {
        const requiredPlan = typeof err.detail.required_plan === "string" ? err.detail.required_plan : "pro";
        setPaywall({ code: err.code, requiredPlan });
        trackEvent("paywall_opened", {
          source: collectionId ? "collection_reader" : "compare_page",
          reason: err.code === "INSUFFICIENT_CREDITS" ? "credits" : "document_diff",
          plan: requiredPlan,
        });
      } else {
        setError(err instanceof Error ? err.message : "Document comparison failed");
      }
    } finally {
      setRunning(false);
    }
  }, [collectionId, locale, newDocumentId, oldDocumentId, running, userPlan]);

  const handleExport = useCallback(async (format: "md" | "csv") => {
    if (!activeRun?.result) return;
    try {
      const blob = await exportDocumentDiffRun(activeRun.id, format);
      downloadBlob(blob, `document-diff-${activeRun.id.slice(0, 8)}.${format}`);
      trackEvent("document_diff_export_clicked", {
        source: collectionId ? "collection_reader" : "compare_page",
        reason: format,
        plan: userPlan,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }, [activeRun, collectionId, userPlan]);

  if (loading) {
    return <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("common.loading", "Loading...")}</div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-white px-4 py-4 dark:bg-zinc-950 sm:px-5">
      <div className="mx-auto max-w-5xl min-w-0 space-y-4">
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                {tOr("diff.kicker", "Semantic document diff")}
              </p>
              <h2 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {tOr("diff.title", "Compare two versions with cited changes")}
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {tOr("diff.subtitle", "DocTalk identifies added, removed, and modified meaning with old/new citations so reviewers can verify both sides.")}
              </p>
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:min-w-[620px]">
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tOr("diff.oldDocument", "Old document")}</span>
                <select
                  value={oldDocumentId}
                  onChange={(event) => setOldDocumentId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {readyDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.filename}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tOr("diff.newDocument", "New document")}</span>
                <select
                  value={newDocumentId}
                  onChange={(event) => setNewDocumentId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {readyDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.filename}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void runCompare()}
                disabled={isWorking || readyDocs.length < 2 || oldDocumentId === newDocumentId}
                className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isWorking ? <Clock3 size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                {isWorking ? tOr("diff.running", "Comparing...") : tOr("diff.run", "Compare")}
              </button>
            </div>
          </div>
          {readyDocs.length < 2 && (
            <p className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              {tOr("diff.needTwoDocs", "Upload or add at least two ready documents to compare.")}
            </p>
          )}
          {paywall && (
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {paywall.code === "INSUFFICIENT_CREDITS"
                  ? tOr("diff.paywallCredits", "You need more credits to compare these documents.")
                  : tOr("diff.paywallPlan", "Document Diff is a Pro workflow.")}
              </span>
              <Link
                href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
                className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {tOr("credits.upgradeToPro", "Upgrade to Pro")}
              </Link>
            </div>
          )}
          {error && (
            <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {activeRun ? (
          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {activeRun.status === "succeeded" ? (
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Clock3 size={16} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  )}
                  <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {oldName || tOr("diff.oldDocument", "Old document")} → {newName || tOr("diff.newDocument", "New document")}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {activeRun.status === "succeeded"
                    ? tOr("diff.completed", "Completed")
                    : tOr("diff.status", "Status: {status}", { status: activeRun.status })}
                </p>
              </div>
              {activeRun.result && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExport("md")}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Download size={14} aria-hidden="true" />
                    MD
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport("csv")}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Download size={14} aria-hidden="true" />
                    CSV
                  </button>
                </div>
              )}
            </div>

            {activeRun.status === "failed" ? (
              <div className="p-4 text-sm text-red-700 dark:text-red-300">
                {activeRun.error_message || tOr("diff.failed", "Document comparison failed.")}
              </div>
            ) : activeRun.result ? (
              <div className="space-y-4 p-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{tOr("diff.summary", "Summary")}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-800 dark:text-zinc-200">{asString(result.summary)}</p>
                </div>
                {(["added", "removed", "modified"] as const).map((kind) => {
                  const items = groupChanges(changes, kind);
                  if (!items.length) return null;
                  const label = kind === "added"
                    ? tOr("diff.added", "Added")
                    : kind === "removed"
                      ? tOr("diff.removed", "Removed")
                      : tOr("diff.modified", "Modified");
                  return (
                    <div key={kind}>
                      <div className="mb-2 flex items-center gap-2">
                        <GitCompare size={15} className="text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                        <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{label}</h4>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((change, index) => (
                          <article key={`${kind}-${index}`} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                                {kind === "added" ? "+" : kind === "removed" ? "-" : "~"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{change.title}</h5>
                                <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{change.detail}</p>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {change.old_refs.map((ref) => {
                                    const raw = citationByLabel.get(`O${ref}`);
                                    if (!raw) return null;
                                    return (
                                      <button
                                        type="button"
                                        key={`old-${ref}`}
                                        onClick={() => handleCitation(raw)}
                                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                      >
                                        <FileText size={12} aria-hidden="true" />
                                        O{ref}
                                      </button>
                                    );
                                  })}
                                  {change.new_refs.map((ref) => {
                                    const raw = citationByLabel.get(`N${ref}`);
                                    if (!raw) return null;
                                    return (
                                      <button
                                        type="button"
                                        key={`new-${ref}`}
                                        onClick={() => handleCitation(raw)}
                                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                      >
                                        <FileText size={12} aria-hidden="true" />
                                        N{ref}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                {tOr("diff.waiting", "The comparison report will appear here when the job finishes.")}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <GitCompare size={32} className="mx-auto text-zinc-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {tOr("diff.emptyTitle", "No comparisons yet")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {tOr("diff.emptyBody", "Choose two ready documents to generate a cited semantic change report.")}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
