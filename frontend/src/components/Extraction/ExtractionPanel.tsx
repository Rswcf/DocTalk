"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileSpreadsheet,
  ListChecks,
  Play,
  RefreshCcw,
  Sparkles,
  Table2,
} from "lucide-react";
import {
  ApiError,
  createExtraction,
  exportDocumentTable,
  exportExtraction,
  getTableScanJob,
  listDocumentTables,
  listDocumentExtractions,
  listExtractionTemplates,
  reconstructDocumentTable,
  scanDocumentTables,
} from "../../lib/api";
import { billingHref } from "../../lib/billingLinks";
import { trackEvent } from "../../lib/analytics";
import { useLocale } from "../../i18n";
import { useDocTalkStore } from "../../store";
import type { Citation, DocumentTable, ExtractionJob, ExtractionTemplate, NormalizedBBox } from "../../types";
import QuestionTemplatesPanel from "../Templates/QuestionTemplatesPanel";

interface ExtractionPanelProps {
  documentId: string;
  onCitationClick: (citation: Citation) => void;
  userPlan?: string;
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
    confidenceScore: typeof raw.confidence_score === "number" ? raw.confidence_score : undefined,
    contextText: typeof raw.context_text === "string" ? raw.context_text : undefined,
  };
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function refs(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
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

export default function ExtractionPanel({ documentId, onCitationClick, userPlan }: ExtractionPanelProps) {
  const { tOr, locale } = useLocale();
  const domainMode = useDocTalkStore((s) => s.domainMode);
  const [activeView, setActiveView] = useState<"deliverables" | "tables" | "templates">("deliverables");
  const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [tables, setTables] = useState<DocumentTable[]>([]);
  const [tableJob, setTableJob] = useState<ExtractionJob | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("executive_summary");
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableScanning, setTableScanning] = useState(false);
  const [tableRebuildingId, setTableRebuildingId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [paywallCode, setPaywallCode] = useState<string | null>(null);
  const [tablePaywallCode, setTablePaywallCode] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    const data = await listDocumentExtractions(documentId);
    setJobs(data);
    return data;
  }, [documentId]);

  const refreshTables = useCallback(async () => {
    const data = await listDocumentTables(documentId);
    setTables(data);
    return data;
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listExtractionTemplates(), listDocumentExtractions(documentId)])
      .then(([templateData, jobData]) => {
        if (cancelled) return;
        setTemplates(templateData);
        setJobs(jobData);
        if (templateData[0] && !templateData.some((item) => item.key === selectedTemplate)) {
          setSelectedTemplate(templateData[0].key);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load extractions");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, selectedTemplate]);

  useEffect(() => {
    let cancelled = false;
    setTableLoading(true);
    refreshTables()
      .then(() => {
        if (!cancelled) setTableLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setTableError(err instanceof Error ? err.message : "Failed to load tables");
          setTableLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTables]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "queued" || job.status === "running")) return;
    const timer = window.setInterval(() => {
      void refreshJobs().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [jobs, refreshJobs]);

  useEffect(() => {
    if (!tableJob || (tableJob.status !== "queued" && tableJob.status !== "running")) return;
    const timer = window.setInterval(() => {
      void getTableScanJob(tableJob.id)
        .then((job) => {
          setTableJob(job);
          if (job.status === "succeeded") {
            void refreshTables().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refreshTables, tableJob]);

  const activeJob = useMemo(() => jobs[0] || null, [jobs]);
  const selectedTemplateInfo = templates.find((item) => item.key === selectedTemplate);

  const runExtraction = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setPaywallCode(null);
    try {
      const job = await createExtraction({
        documentId,
        templateKey: selectedTemplate,
        locale,
        domainMode: domainMode === "legal" || domainMode === "academic" ? domainMode : null,
      });
      setJobs((prev) => [job, ...prev.filter((item) => item.id !== job.id)]);
      trackEvent("extraction_created", {
        source: "extraction_panel",
        reason: selectedTemplate,
        plan: userPlan,
      });
      window.setTimeout(() => {
        void refreshJobs().catch(() => undefined);
      }, 1200);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "INSUFFICIENT_CREDITS" || err.code === "EXTRACTION_LIMIT_REACHED")) {
        setPaywallCode(err.code);
      } else {
        setError(err instanceof Error ? err.message : "Extraction failed");
      }
    } finally {
      setRunning(false);
    }
  }, [documentId, domainMode, locale, refreshJobs, running, selectedTemplate, userPlan]);

  const handleExport = useCallback(async (job: ExtractionJob, format: "md" | "csv") => {
    try {
      const blob = await exportExtraction(job.id, format);
      downloadBlob(blob, `extraction-${job.id.slice(0, 8)}.${format}`);
      trackEvent("extraction_export_clicked", {
        source: "extraction_panel",
        reason: format,
        plan: userPlan,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }, [userPlan]);

  const handleScanTables = useCallback(async () => {
    if (tableScanning) return;
    setTableScanning(true);
    setTableError(null);
    setTablePaywallCode(null);
    try {
      const job = await scanDocumentTables(documentId);
      setTableJob(job);
      trackEvent("table_scan_created", {
        source: "extraction_panel",
        reason: "tables",
        plan: userPlan,
      });
      window.setTimeout(() => {
        void refreshTables().catch(() => undefined);
      }, 1500);
    } catch (err) {
      setTableError(err instanceof Error ? err.message : "Table scan failed");
    } finally {
      setTableScanning(false);
    }
  }, [documentId, refreshTables, tableScanning, userPlan]);

  const handleTableExport = useCallback(async (table: DocumentTable) => {
    try {
      const blob = await exportDocumentTable(table.id);
      downloadBlob(blob, `table-p${table.page}-${table.table_index + 1}.csv`);
      trackEvent("table_export_clicked", {
        source: "extraction_panel",
        reason: "csv",
        plan: userPlan,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "PLAN_REQUIRED") {
        setTablePaywallCode(err.code);
      } else {
        setTableError(err instanceof Error ? err.message : "Table export failed");
      }
    }
  }, [userPlan]);

  const handleTableReconstruct = useCallback(async (table: DocumentTable) => {
    if (tableRebuildingId) return;
    setTableRebuildingId(table.id);
    setTableError(null);
    setTablePaywallCode(null);
    try {
      const job = await reconstructDocumentTable(table.id);
      setTableJob(job);
      trackEvent("table_reconstruct_created", {
        source: "extraction_panel",
        reason: "tables_ai_rebuild",
        plan: userPlan,
      });
      window.setTimeout(() => {
        void refreshTables().catch(() => undefined);
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PLAN_REQUIRED") {
        setTablePaywallCode(err.code);
      } else {
        setTableError(err instanceof Error ? err.message : "AI table reconstruction failed");
      }
    } finally {
      setTableRebuildingId(null);
    }
  }, [refreshTables, tableRebuildingId, userPlan]);

  const citationMap = useMemo(() => {
    const map = new Map<number, Citation>();
    const raw = activeJob?.result?.citations || [];
    for (const item of raw) {
      const citation = toCitation(item);
      if (citation) map.set(citation.refIndex, citation);
    }
    return map;
  }, [activeJob]);

  const refButtons = useCallback((sourceRefs: unknown) => {
    const sourceRefsList = refs(sourceRefs);
    if (sourceRefsList.length === 0) return null;
    return (
      <span className="inline-flex flex-wrap gap-1 align-middle">
        {sourceRefsList.map((ref) => {
          const citation = citationMap.get(ref);
          return (
            <button
              key={ref}
              type="button"
              onClick={() => citation && onCitationClick(citation)}
              disabled={!citation}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[var(--reader-evidence-soft)] px-1.5 text-[11px] font-semibold text-[var(--reader-evidence)] ring-1 ring-[var(--reader-evidence-border)] disabled:opacity-50"
              title={citation ? tOr("citation.jumpTo", "Jump to page {page}", { page: citation.page }) : undefined}
            >
              {ref}
            </button>
          );
        })}
      </span>
    );
  }, [citationMap, onCitationClick, tOr]);

  const result = activeJob?.result;
  const data = result?.structured_json || {};
  const templateKey = result?.template_key || activeJob?.input_scope?.template_key;

  return (
    <div className="flex h-full flex-col bg-[var(--reader-panel-solid)]">
      <div className="border-b border-[var(--reader-border)] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase text-[var(--reader-muted)]">
              {tOr("extract.kicker", "Structured Extraction")}
            </p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--reader-ink)]">
              {tOr("extract.title", "Create a cited deliverable")}
            </h2>
          </div>
          <Sparkles aria-hidden="true" size={18} className="text-[var(--reader-evidence)]" />
        </div>
        <div className="mt-3 flex rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] p-1">
          <button
            type="button"
            onClick={() => setActiveView("deliverables")}
            className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors ${
              activeView === "deliverables"
                ? "bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm"
                : "text-[var(--reader-muted)]"
            }`}
          >
            <Sparkles size={13} aria-hidden="true" />
            {tOr("extract.deliverablesTab", "Deliverables")}
          </button>
          <button
            type="button"
            onClick={() => setActiveView("tables")}
            className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors ${
              activeView === "tables"
                ? "bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm"
                : "text-[var(--reader-muted)]"
            }`}
          >
            <Table2 size={13} aria-hidden="true" />
            {tOr("tables.tab", "Tables")}
          </button>
          <button
            type="button"
            onClick={() => setActiveView("templates")}
            className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium transition-colors ${
              activeView === "templates"
                ? "bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm"
                : "text-[var(--reader-muted)]"
            }`}
          >
            <ClipboardList size={13} aria-hidden="true" />
            {tOr("templates.tab", "Templates")}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {activeView === "templates" ? (
          <div className="-mx-4 -my-4 h-[calc(100%+2rem)] sm:-mx-5">
            <QuestionTemplatesPanel
              scope={{ type: "document", documentId }}
              onCitationClick={onCitationClick}
              userPlan={userPlan}
              documentCount={1}
            />
          </div>
        ) : activeView === "tables" ? (
          <TablesView
            tables={tables}
            job={tableJob}
            loading={tableLoading}
            scanning={tableScanning}
            error={tableError}
            paywallCode={tablePaywallCode}
            rebuildingTableId={tableRebuildingId}
            onScan={handleScanTables}
            onReconstruct={handleTableReconstruct}
            onExport={handleTableExport}
            tOr={tOr}
          />
        ) : loading ? (
          <div className="text-sm text-[var(--reader-muted)]">{tOr("common.loading", "Loading...")}</div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            <section className="rounded-lg border border-[var(--reader-border)] bg-white/70 p-3 shadow-sm dark:bg-zinc-900/50">
              <div className="grid gap-2 sm:grid-cols-3">
                {templates.map((template) => {
                  const active = selectedTemplate === template.key;
                  const Icon = template.key === "key_facts" ? FileSpreadsheet : template.key === "evidence_table" ? ListChecks : Sparkles;
                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => setSelectedTemplate(template.key)}
                      className={`min-h-24 rounded-lg border p-3 text-left transition-colors ${
                        active
                          ? "border-[var(--reader-evidence)] bg-[var(--reader-evidence-soft)]"
                          : "border-[var(--reader-border)] bg-[var(--reader-panel-solid)] hover:bg-[var(--reader-panel-muted)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={15} className="text-[var(--reader-evidence)]" aria-hidden="true" />
                        <span className="text-sm font-semibold text-[var(--reader-ink)]">{template.title}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--reader-muted)]">{template.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--reader-muted)]">
                  {selectedTemplateInfo?.description || tOr("extract.chooseTemplate", "Choose an extraction template.")}
                </p>
                <button
                  type="button"
                  onClick={() => void runExtraction()}
                  disabled={running || jobs.some((job) => job.status === "queued" || job.status === "running")}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Play size={14} aria-hidden="true" />
                  {running ? tOr("extract.starting", "Starting...") : tOr("extract.run", "Run extraction")}
                </button>
              </div>
              {paywallCode && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-medium">
                    {paywallCode === "EXTRACTION_LIMIT_REACHED"
                      ? tOr("extract.limitReached", "Free extraction limit reached.")
                      : tOr("credits.insufficientCredits", "Insufficient Credits")}
                  </p>
                  <Link
                    href={billingHref({ plan: "plus", source: "extraction_panel", reason: paywallCode.toLowerCase() })}
                    className="mt-2 inline-flex text-sm font-medium underline"
                  >
                    {tOr("credits.upgradeToPlus", "Upgrade to Plus")}
                  </Link>
                </div>
              )}
              {error && (
                <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
            </section>

            {activeJob && (
              <section className="rounded-lg border border-[var(--reader-border)] bg-white/80 p-4 shadow-sm dark:bg-zinc-900/50">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    {activeJob.status === "succeeded" ? (
                      <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
                    ) : activeJob.status === "failed" ? (
                      <AlertTriangle size={16} className="text-red-600" aria-hidden="true" />
                    ) : (
                      <Clock3 size={16} className="text-amber-600" aria-hidden="true" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--reader-ink)]">
                        {templates.find((item) => item.key === activeJob.input_scope?.template_key)?.title || tOr("extract.result", "Extraction result")}
                      </h3>
                      <p className="text-xs text-[var(--reader-muted)]">
                        {activeJob.status === "succeeded"
                          ? tOr("extract.status.succeeded", "Ready")
                          : activeJob.status === "failed"
                            ? tOr("extract.status.failed", "Failed")
                            : tOr("extract.status.running", "Working...")}
                      </p>
                    </div>
                  </div>
                  {activeJob.status === "succeeded" && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void handleExport(activeJob, "md")} className="inline-flex items-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]">
                        <Download size={13} aria-hidden="true" /> MD
                      </button>
                      <button type="button" onClick={() => void handleExport(activeJob, "csv")} className="inline-flex items-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]">
                        <Download size={13} aria-hidden="true" /> CSV
                      </button>
                    </div>
                  )}
                </div>

                {activeJob.status === "failed" && (
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {activeJob.error_message || tOr("extract.failed", "Extraction failed. Try again.")}
                  </p>
                )}
                {(activeJob.status === "queued" || activeJob.status === "running") && (
                  <div className="space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--reader-evidence)] motion-reduce:animate-none" />
                    </div>
                    <p className="text-sm text-[var(--reader-muted)]">{tOr("extract.runningHint", "DocTalk is reading the document and building cited results.")}</p>
                  </div>
                )}
                {activeJob.status === "succeeded" && result && (
                  <ResultView templateKey={String(templateKey || "")} data={data} refButtons={refButtons} />
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TablesView({
  tables,
  job,
  loading,
  scanning,
  error,
  paywallCode,
  rebuildingTableId,
  onScan,
  onReconstruct,
  onExport,
  tOr,
}: {
  tables: DocumentTable[];
  job: ExtractionJob | null;
  loading: boolean;
  scanning: boolean;
  error: string | null;
  paywallCode: string | null;
  rebuildingTableId: string | null;
  onScan: () => void;
  onReconstruct: (table: DocumentTable) => void;
  onExport: (table: DocumentTable) => void;
  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
}) {
  const isWorking = scanning || job?.status === "queued" || job?.status === "running";
  const methodLabel = (table: DocumentTable) => {
    if (table.method === "llm_reconstructed") return tOr("tables.methodAiRebuilt", "AI rebuilt");
    if (table.method === "pymupdf") return tOr("tables.methodBasicParser", "Basic parser");
    if (table.method === "azure") return tOr("tables.methodLayoutModel", "Layout model");
    return table.method;
  };
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-lg border border-[var(--reader-border)] bg-white/70 p-4 shadow-sm dark:bg-zinc-900/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-mono uppercase text-[var(--reader-muted)]">
              {tables.length > 0
                ? tOr("tables.detected", "{count} tables detected", { count: tables.length })
                : tOr("tables.noneYet", "No tables scanned yet")}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-[var(--reader-ink)]">
              {tOr("tables.title", "Extract tables to CSV")}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onScan()}
            disabled={isWorking}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <RefreshCcw size={14} aria-hidden="true" />
            {isWorking ? tOr("tables.scanning", "Scanning...") : tOr("tables.scan", "Scan tables")}
          </button>
        </div>
        {job && (
          <p className="mt-3 text-xs text-[var(--reader-muted)]">
            {job.status === "succeeded"
              ? job.job_type === "table_reconstruct"
                ? tOr("tables.rebuildReady", "AI table rebuild complete")
                : tOr("tables.scanReady", "Scan complete")
              : job.status === "failed"
                ? job.error_message || tOr("tables.scanFailed", "Table scan failed")
                : job.job_type === "table_reconstruct"
                  ? tOr("tables.rebuildRunning", "DocTalk is rebuilding the selected table with AI.")
                  : tOr("tables.scanRunning", "DocTalk is detecting tables in this document.")}
          </p>
        )}
        {paywallCode && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">{tOr("tables.exportRequiresPlus", "CSV table export requires Plus.")}</p>
            <Link
              href={billingHref({ plan: "plus", source: "tables_panel", reason: paywallCode.toLowerCase() })}
              className="mt-2 inline-flex text-sm font-medium underline"
            >
              {tOr("credits.upgradeToPlus", "Upgrade to Plus")}
            </Link>
          </div>
        )}
        {error && (
          <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {loading ? (
        <div className="text-sm text-[var(--reader-muted)]">{tOr("common.loading", "Loading...")}</div>
      ) : tables.length === 0 ? (
        <section className="rounded-lg border border-dashed border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-6 text-sm leading-6 text-[var(--reader-muted)]">
          {tOr("tables.empty", "Run a scan to preview tables found in this document. CSV export is available on Plus and Pro.")}
        </section>
      ) : (
        <div className="space-y-4">
          {tables.map((table) => (
            <section key={table.id} className="rounded-lg border border-[var(--reader-border)] bg-white/80 p-4 shadow-sm dark:bg-zinc-900/50">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--reader-ink)]">
                    {tOr("tables.tableTitle", "Page {page} · Table {index}", {
                      page: table.page_end && table.page_end !== table.page ? `${table.page}-${table.page_end}` : table.page,
                      index: table.table_index + 1,
                    })}
                  </h4>
                  <p className="text-xs text-[var(--reader-muted)]">
                    {methodLabel(table)} · {Math.round(table.confidence * 100)}%
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onReconstruct(table)}
                    disabled={isWorking || rebuildingTableId === table.id}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)] disabled:opacity-50"
                    title={tOr("tables.aiRebuildHint", "Use AI to rebuild this table from source page text. Verify numbers against the document.")}
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    {rebuildingTableId === table.id ? tOr("tables.rebuilding", "Rebuilding...") : tOr("tables.aiRebuild", "AI rebuild")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onExport(table)}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]"
                  >
                    <Download size={13} aria-hidden="true" /> CSV
                  </button>
                </div>
              </div>
              {table.method === "pymupdf" && (
                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  {tOr("tables.basicParserWarning", "Basic extraction can misalign wide or complex tables. Use AI rebuild for a source-grounded reconstruction.")}
                </p>
              )}
              {table.method === "llm_reconstructed" && (
                <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs leading-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  {tOr("tables.aiRebuiltWarning", "AI rebuilt this table from source page text. Verify critical numbers against the citation view before reuse.")}
                </p>
              )}
              {table.warnings?.length > 0 && (
                <div className="mb-3 space-y-1">
                  {table.warnings.slice(0, 3).map((warning, index) => (
                    <p key={index} className="rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-2 py-1.5 text-xs leading-5 text-[var(--reader-muted)]">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <tbody>
                    {table.rows.slice(0, 8).map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex === 0 ? "font-semibold text-[var(--reader-ink)]" : ""}>
                        {row.slice(0, 6).map((cell, cellIndex) => (
                          <td key={cellIndex} className="border border-[var(--reader-border)] px-2 py-1.5 align-top">
                            {cell || <span className="text-[var(--reader-muted)]">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(table.rows.length > 8 || (table.rows[0]?.length || 0) > 6) && (
                <p className="mt-2 text-xs text-[var(--reader-muted)]">
                  {tOr("tables.previewTruncated", "Preview truncated. Export CSV for the full table.")}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultView({
  templateKey,
  data,
  refButtons,
}: {
  templateKey: string;
  data: Record<string, unknown>;
  refButtons: (sourceRefs: unknown) => React.ReactNode;
}) {
  if (templateKey === "key_facts") {
    const facts = asArray(data.facts);
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase text-[var(--reader-muted)]">
            <tr>
              <th className="border-b border-[var(--reader-border)] px-2 py-2">Fact</th>
              <th className="border-b border-[var(--reader-border)] px-2 py-2">Value</th>
              <th className="border-b border-[var(--reader-border)] px-2 py-2">Context</th>
              <th className="border-b border-[var(--reader-border)] px-2 py-2">Sources</th>
            </tr>
          </thead>
          <tbody>
            {facts.map((item, index) => (
              <tr key={index} className="align-top">
                <td className="border-b border-[var(--reader-border)] px-2 py-2 font-medium">{asString(item.label)}</td>
                <td className="border-b border-[var(--reader-border)] px-2 py-2">{asString(item.value)}</td>
                <td className="border-b border-[var(--reader-border)] px-2 py-2">{asString(item.context)}</td>
                <td className="border-b border-[var(--reader-border)] px-2 py-2">{refButtons(item.source_refs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (templateKey === "evidence_table") {
    const items = asArray(data.items);
    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <article key={index} className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-[var(--reader-ink)]">{asString(item.topic) || "Evidence"}</h4>
              {refButtons(item.source_refs)}
            </div>
            <p className="text-sm font-medium leading-6 text-[var(--reader-ink)]">{asString(item.finding)}</p>
            {item.evidence ? <p className="mt-2 text-sm leading-6 text-[var(--reader-muted)]">{asString(item.evidence)}</p> : null}
          </article>
        ))}
      </div>
    );
  }

  const keyPoints = asArray(data.key_points);
  const risks = asArray(data.risks_or_open_questions);
  return (
    <div className="space-y-5 text-sm leading-7">
      {data.summary ? <p className="text-[var(--reader-ink)]">{asString(data.summary)}</p> : null}
      <div>
        <h4 className="mb-2 text-xs font-mono uppercase text-[var(--reader-muted)]">Key points</h4>
        <ul className="space-y-2">
          {keyPoints.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--reader-evidence)]" />
              <span>{asString(item.text)} {refButtons(item.source_refs)}</span>
            </li>
          ))}
        </ul>
      </div>
      {risks.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-mono uppercase text-[var(--reader-muted)]">Risks / open questions</h4>
          <ul className="space-y-2">
            {risks.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{asString(item.text)} {refButtons(item.source_refs)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
