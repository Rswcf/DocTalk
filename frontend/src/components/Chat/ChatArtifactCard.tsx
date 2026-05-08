"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Download, FileText, RefreshCw, Table2 } from 'lucide-react';
import type { ChatArtifact, Citation } from '../../types';
import { getDocumentJob, PROXY_BASE } from '../../lib/api';
import { useLocale } from '../../i18n';

interface ChatArtifactCardProps {
  artifact: ChatArtifact;
  onCitationClick?: (citation: Citation) => void;
}

function proxiedUrl(url: string): string {
  if (!url) return '#';
  if (/^https?:\/\//.test(url)) return url;
  return `${PROXY_BASE}${url.startsWith('/') ? url : `/${url}`}`;
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

export default function ChatArtifactCard({ artifact, onCitationClick }: ChatArtifactCardProps) {
  const { tOr } = useLocale();
  const [current, setCurrent] = useState(artifact);
  const isPending = current.status === 'queued' || current.status === 'running';
  const isFailed = current.status === 'failed';
  const isDone = current.status === 'succeeded';

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
  const Icon = current.artifactType.includes('table') ? Table2 : FileText;

  return (
    <div className="not-prose mt-4 overflow-hidden rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] shadow-sm">
      <div className="flex items-start gap-3 border-b border-[var(--reader-border)] px-4 py-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] text-[var(--reader-evidence)]">
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--reader-ink)]">{current.title}</p>
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
          <p className="mt-1 text-sm leading-relaxed text-[var(--reader-muted)]">{current.summary}</p>
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
            return (
              <div key={`${current.jobId || current.title}-${index}`} className="overflow-hidden rounded-md border border-[var(--reader-border)]">
                <div className="flex items-center justify-between bg-[var(--reader-panel-muted)] px-3 py-2 text-xs text-[var(--reader-muted)]">
                  <span>p.{String(item.page || '?')} · table {Number(item.table_index || 0) + 1}</span>
                  {typeof item.confidence === 'number' ? <span>{Math.round(item.confidence * 100)}%</span> : null}
                </div>
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

      {(current.downloadUrls?.length || current.requiredPlan || current.citations?.length) ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--reader-border)] px-4 py-3">
          {current.downloadUrls?.map((item) => (
            <a
              key={`${item.format}-${item.url}`}
              href={proxiedUrl(item.url)}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Download size={14} aria-hidden="true" />
              {item.label}
            </a>
          ))}
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
