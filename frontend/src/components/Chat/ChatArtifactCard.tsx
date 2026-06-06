"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Download, ExternalLink, Eye, FilePlus2, FileText, Languages, Loader2, RefreshCw, Sparkles, Table2 } from 'lucide-react';
import type { ChatArtifact, Citation, DocumentTable } from '../../types';
import { getDocumentJob, getTableScanJob, importLayoutTranslationDocument, listDocumentTables, reconstructDocumentTable } from '../../lib/api';
import { absoluteProxiedArtifactUrl, proxiedArtifactUrl } from '../../lib/layoutTranslation';
import { useLocale } from '../../i18n';

interface ChatArtifactCardProps {
  artifact: ChatArtifact;
  onCitationClick?: (citation: Citation) => void;
  onPreviewLayoutTranslation?: (url: string, artifact: ChatArtifact) => void;
}

function rowsFromPreview(preview: unknown): Array<Record<string, unknown>> {
  return Array.isArray(preview)
    ? preview.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
}

function markdownPreview(preview: unknown): string {
  if (preview && typeof preview === 'object' && 'markdown' in preview) {
    const value = (preview as { markdown?: unknown }).markdown;
    return typeof value === 'string' ? value : '';
  }
  return '';
}

function documentIdFromArtifact(artifact: ChatArtifact, previewRows: Array<Record<string, unknown>>): string | null {
  for (const item of previewRows) {
    if (typeof item.document_id === 'string') return item.document_id;
  }
  for (const citation of artifact.citations || []) {
    if (citation.documentId) return citation.documentId;
  }
  for (const item of artifact.downloadUrls || []) {
    const match = item.url.match(/\/api\/documents\/([^/]+)\/tables/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function tableToPreview(table: DocumentTable): Record<string, unknown> {
  return {
    table_id: table.id,
    document_id: table.document_id,
    page: table.page,
    page_end: table.page_end,
    table_index: table.table_index,
    rows: table.rows,
    confidence: table.confidence,
    method: table.method,
    warnings: table.warnings,
    metadata_json: table.metadata_json,
  };
}

function tableMethodLabel(method: unknown, tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string): string {
  if (method === 'llm_reconstructed') return tOr('tables.methodAiRebuilt', 'AI rebuilt');
  if (method === 'pymupdf') return tOr('tables.methodBasicParser', 'Basic parser');
  if (method === 'azure') return tOr('tables.methodLayoutModel', 'Layout model');
  return typeof method === 'string' && method ? method : '';
}

export default function ChatArtifactCard({ artifact, onCitationClick, onPreviewLayoutTranslation }: ChatArtifactCardProps) {
  const { tOr, locale } = useLocale();
  const [current, setCurrent] = useState(artifact);
  const [tableJob, setTableJob] = useState<{ id: string; status: string; tableId: string } | null>(null);
  const [rebuildingTableId, setRebuildingTableId] = useState<string | null>(null);
  const [tableRebuildError, setTableRebuildError] = useState<string | null>(null);
  const [layoutImporting, setLayoutImporting] = useState(false);
  const [layoutImportError, setLayoutImportError] = useState<string | null>(null);
  const autoImportAttemptedRef = useRef(false);
  const isPending = current.status === 'queued' || current.status === 'running';
  const isFailed = current.status === 'failed';
  const isDone = current.status === 'succeeded';
  const isLayoutTranslation = current.artifactType === 'layout_translation';

  useEffect(() => {
    setCurrent(artifact);
  }, [artifact]);

  useEffect(() => {
    if (!current.jobId || !isPending) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getDocumentJob(current.jobId || '')
        .then((job) => {
          if (!cancelled) setCurrent(job.artifact);
        })
        .catch(() => {
          // Keep the existing card; the next poll may recover.
        });
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [current.jobId, isPending]);

  const previewRows = useMemo(() => rowsFromPreview(current.preview), [current.preview]);
  const previewMarkdown = useMemo(() => markdownPreview(current.preview), [current.preview]);
  const layoutPreview = useMemo(
    () => (current.preview && typeof current.preview === 'object' ? current.preview as Record<string, unknown> : {}),
    [current.preview],
  );
  const Icon = isLayoutTranslation
    ? Languages
    : current.artifactType.includes('table')
      ? Table2
      : FileText;
  const displayTitle = isLayoutTranslation
    ? tOr('layoutTranslation.artifactTitle', 'Layout-preserved PDF translation')
    : current.title;
  const displaySummary = isLayoutTranslation
    ? isDone
      ? tOr('layoutTranslation.summarySucceeded', 'Layout-preserved PDF translation is ready.')
      : isFailed
        ? tOr('layoutTranslation.summaryFailed', 'Layout-preserving PDF translation failed.')
        : tOr('layoutTranslation.summaryQueued', 'Translating this PDF while preserving layout.')
    : current.summary;
  const downloadUrls = useMemo(() => {
    if (!isLayoutTranslation) return current.downloadUrls || [];
    return (current.downloadUrls || []).map((item) => {
      if (item.format === 'pdf') {
        return { ...item, label: tOr('layoutTranslation.downloadPdf', 'Translated PDF') };
      }
      if (item.format === 'md') {
        return { ...item, label: tOr('layoutTranslation.downloadMarkdown', 'Markdown') };
      }
      if (item.format === 'zip') {
        return { ...item, label: tOr('layoutTranslation.downloadBundle', 'Bundle') };
      }
      return item;
    });
  }, [current.downloadUrls, isLayoutTranslation, tOr]);
  const artifactDocumentId = useMemo(() => documentIdFromArtifact(current, previewRows), [current, previewRows]);
  const tableJobPending = tableJob?.status === 'queued' || tableJob?.status === 'running';
  const pdfDownload = isLayoutTranslation ? downloadUrls.find((item) => item.format === 'pdf') : undefined;
  const importedDocumentId = typeof layoutPreview.imported_document_id === 'string' ? layoutPreview.imported_document_id : null;
  const importedDocumentFilename = typeof layoutPreview.imported_document_filename === 'string' ? layoutPreview.imported_document_filename : null;
  const importRequested = Boolean(layoutPreview.add_to_library_requested);

  useEffect(() => {
    if (!tableJob || !tableJobPending) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getTableScanJob(tableJob.id)
        .then(async (job) => {
          if (cancelled) return;
          if (job.status === 'succeeded') {
            let nextPreview: unknown | null = null;
            if (artifactDocumentId) {
              try {
                const tables = await listDocumentTables(artifactDocumentId);
                nextPreview = tables.map(tableToPreview);
              } catch {
                nextPreview = null;
              }
            }
            if (cancelled) return;
            setCurrent((prev) => {
              const fallbackPreview = rowsFromPreview(prev.preview).map((item) => (
                item.table_id === tableJob.tableId
                  ? {
                      ...item,
                      method: 'llm_reconstructed',
                      confidence: typeof item.confidence === 'number' ? Math.max(item.confidence, 0.9) : 0.9,
                      warnings: [
                        ...(
                          Array.isArray(item.warnings)
                            ? item.warnings.map((warning) => String(warning))
                            : []
                        ),
                        tOr('tables.aiRebuiltWarning', 'AI rebuilt this table from source page text. Verify critical numbers against the citation view before reuse.'),
                      ],
                    }
                  : item
              ));
              return {
                ...prev,
                summary: tOr('tables.rebuildReady', 'AI table rebuild complete'),
                preview: nextPreview || fallbackPreview,
              };
            });
            setTableJob({ id: job.id, status: job.status, tableId: tableJob.tableId });
          } else {
            setTableJob({ id: job.id, status: job.status, tableId: tableJob.tableId });
          }
        })
        .catch(() => undefined);
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [artifactDocumentId, tableJob, tableJobPending, tOr]);

  const handleAiRebuild = async (tableId: string) => {
    if (rebuildingTableId || tableJobPending) return;
    setRebuildingTableId(tableId);
    setTableRebuildError(null);
    try {
      const job = await reconstructDocumentTable(tableId);
      setTableJob({ id: job.id, status: job.status, tableId });
      setCurrent((prev) => ({
        ...prev,
        summary: tOr('tables.rebuildRunning', 'DocTalk is rebuilding the selected table with AI.'),
      }));
    } catch (err) {
      setTableRebuildError(err instanceof Error ? err.message : 'AI table reconstruction failed');
    } finally {
      setRebuildingTableId(null);
    }
  };

  const handlePreviewLayoutTranslation = () => {
    if (!pdfDownload?.url) return;
    onPreviewLayoutTranslation?.(absoluteProxiedArtifactUrl(pdfDownload.url), current);
  };

  const handleImportLayoutTranslation = async () => {
    if (!current.jobId || layoutImporting || importedDocumentId) return;
    setLayoutImporting(true);
    setLayoutImportError(null);
    try {
      const result = await importLayoutTranslationDocument(current.jobId, locale);
      setCurrent((prev) => ({
        ...prev,
        preview: {
          ...(prev.preview && typeof prev.preview === 'object' ? prev.preview as Record<string, unknown> : {}),
          imported_document_id: result.document_id,
          imported_document_filename: result.filename,
          imported_document_status: result.status,
          import_error: null,
        },
      }));
    } catch (err) {
      setLayoutImportError(err instanceof Error ? err.message : 'Document import failed');
    } finally {
      setLayoutImporting(false);
    }
  };

  useEffect(() => {
    if (!isLayoutTranslation || !isDone || !importRequested || importedDocumentId || autoImportAttemptedRef.current) return;
    autoImportAttemptedRef.current = true;
    void handleImportLayoutTranslation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importRequested, importedDocumentId, isDone, isLayoutTranslation]);

  return (
    <div className="not-prose mt-4 overflow-hidden rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] shadow-sm">
      <div className="flex items-start gap-3 border-b border-[var(--reader-border)] px-4 py-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] text-[var(--reader-evidence)]">
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--reader-ink)]">{displayTitle}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isFailed
                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                : isDone
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}>
              {isFailed ? <AlertTriangle size={12} /> : isDone ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
              {current.status}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--reader-muted)]">{displaySummary}</p>
          {tableRebuildError ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{tableRebuildError}</p>
          ) : null}
          {layoutImportError ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{layoutImportError}</p>
          ) : null}
          {isLayoutTranslation && typeof layoutPreview.import_error === 'string' && layoutPreview.import_error ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{layoutPreview.import_error}</p>
          ) : null}
          {current.warning ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{current.warning}</p>
          ) : null}
        </div>
        {isPending ? <RefreshCw size={16} className="mt-2 shrink-0 animate-spin text-[var(--reader-muted)] motion-reduce:animate-none" /> : null}
      </div>

      {previewRows.length > 0 ? (
        <div className="space-y-3 px-4 py-3">
          {previewRows.map((item, index) => {
            const rows = Array.isArray(item.rows) ? item.rows.slice(0, 4) : [];
            const tableId = typeof item.table_id === 'string' ? item.table_id : null;
            const warnings = Array.isArray(item.warnings) ? item.warnings.map((warning) => String(warning)) : [];
            const methodLabel = tableMethodLabel(item.method, tOr);
            const isAiRebuilt = item.method === 'llm_reconstructed';
            return (
              <div key={`${current.jobId || current.title}-${index}`} className="overflow-hidden rounded-md border border-[var(--reader-border)]">
                <div className="flex items-center justify-between bg-[var(--reader-panel-muted)] px-3 py-2 text-xs text-[var(--reader-muted)]">
                  <span>
                    p.{String(item.page_end && item.page_end !== item.page ? `${item.page}-${item.page_end}` : item.page || '?')} · table {Number(item.table_index || 0) + 1}
                    {methodLabel ? ` · ${methodLabel}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    {typeof item.confidence === 'number' ? <span>{Math.round(item.confidence * 100)}%</span> : null}
                    {tableId ? (
                      <button
                        type="button"
                        onClick={() => void handleAiRebuild(tableId)}
                        disabled={Boolean(rebuildingTableId) || tableJobPending}
                        className="inline-flex min-h-7 items-center gap-1 rounded border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2 text-[11px] font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] disabled:opacity-50"
                        title={tOr('tables.aiRebuildHint', 'Use AI to rebuild this table from source page text. Verify numbers against the document.')}
                      >
                        <Sparkles size={12} aria-hidden="true" />
                        {rebuildingTableId === tableId ? tOr('tables.rebuilding', 'Rebuilding...') : tOr('tables.aiRebuild', 'AI rebuild')}
                      </button>
                    ) : null}
                  </span>
                </div>
                {item.method === 'pymupdf' ? (
                  <p className="border-t border-[var(--reader-border)] bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    {tOr('tables.basicParserWarning', 'Basic extraction can misalign wide or complex tables. Use AI rebuild for a source-grounded reconstruction.')}
                  </p>
                ) : null}
                {isAiRebuilt ? (
                  <p className="border-t border-[var(--reader-border)] bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                    {tOr('tables.aiRebuiltWarning', 'AI rebuilt this table from source page text. Verify critical numbers against the citation view before reuse.')}
                  </p>
                ) : null}
                {warnings.slice(0, 2).map((warning, warningIndex) => (
                  <p key={warningIndex} className="border-t border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 py-2 text-xs leading-5 text-[var(--reader-muted)]">
                    {warning}
                  </p>
                ))}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-[var(--reader-border)]">
                          {Array.isArray(row) ? row.slice(0, 5).map((cell, cellIndex) => (
                            <td key={cellIndex} className="max-w-40 truncate px-3 py-2 text-[var(--reader-ink)]">
                              {String(cell || '')}
                            </td>
                          )) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : previewMarkdown ? (
        <div className="max-h-52 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-[var(--reader-ink)]">
          {previewMarkdown}
        </div>
      ) : null}

      {(downloadUrls.length || current.requiredPlan || current.citations?.length) ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--reader-border)] px-4 py-3">
          {isLayoutTranslation && isDone && pdfDownload && onPreviewLayoutTranslation ? (
            <button
              type="button"
              onClick={handlePreviewLayoutTranslation}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Eye size={14} aria-hidden="true" />
              {tOr('layoutTranslation.previewPdf', 'Preview PDF')}
            </button>
          ) : null}
          {downloadUrls.map((item) => (
            <a
              key={`${item.format}-${item.url}`}
              href={proxiedArtifactUrl(item.url)}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Download size={14} aria-hidden="true" />
              {item.label}
            </a>
          ))}
          {isLayoutTranslation && isDone ? (
            importedDocumentId ? (
              <a
                href={`/d/${importedDocumentId}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400"
                title={importedDocumentFilename || undefined}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {tOr('layoutTranslation.openImportedDocument', 'Open DocTalk document')}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void handleImportLayoutTranslation()}
                disabled={layoutImporting}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {layoutImporting ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FilePlus2 size={14} aria-hidden="true" />}
                {layoutImporting
                  ? tOr('layoutTranslation.importingDocument', 'Adding...')
                  : tOr('layoutTranslation.addDocument', 'Add to DocTalk')}
              </button>
            )
          ) : null}
          {current.requiredPlan ? (
            <span className="text-xs font-medium text-[var(--reader-muted)]">
              {tOr('chat.artifact.planRequired', 'Export requires Plus')}
            </span>
          ) : null}
          {current.citations?.slice(0, 4).map((citation, index) => (
            <button
              key={`${citation.chunkId}-${index}`}
              type="button"
              onClick={() => onCitationClick?.(citation)}
              className="inline-flex min-h-8 items-center rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2 text-xs font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95"
            >
              p.{citation.page}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
