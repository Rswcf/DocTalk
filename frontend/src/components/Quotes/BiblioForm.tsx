"use client";

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { useLocale } from '../../i18n';
import { updateDocumentBiblio } from '../../lib/api';
import type { CslAuthor, DocumentBiblioCsl } from '../../lib/api';

interface BiblioFormProps {
  documentId: string;
  initialBiblio: DocumentBiblioCsl | null;
  onClose: () => void;
  onSaved: (biblio: DocumentBiblioCsl) => void;
}

/** "Family, Given" one author per line -> CSL author objects. A line with
 * no comma is treated as a family-only name (matches the backend seed
 * heuristic's single-token fallback in biblio_service.py). Blank lines
 * are dropped. */
function parseAuthorsText(text: string): CslAuthor[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const commaIdx = line.indexOf(',');
      if (commaIdx === -1) return { family: line };
      const family = line.slice(0, commaIdx).trim();
      const given = line.slice(commaIdx + 1).trim();
      return given ? { family, given } : { family };
    });
}

function authorsToText(authors: CslAuthor[] | undefined): string {
  return (authors || [])
    .map((a) => (a.given ? `${a.family || ''}, ${a.given}` : (a.family || '')))
    .join('\n');
}

/**
 * Minimal editable citation metadata (F2, plan §8.4 point 4 / D6). Backed
 * by GET/PUT /documents/{id}/biblio (B6) — PUT always writes the CALLING
 * user's own row, never the shared system default or another user's row
 * (backend `upsert_user_biblio`), so edits on a shared/demo document never
 * leak into another user's citation view. No citeproc/Crossref lookup in
 * M2 — this is a plain form over {title, author[], issued.year}.
 */
export default function BiblioForm({ documentId, initialBiblio, onClose, onSaved }: BiblioFormProps) {
  const { tOr } = useLocale();
  const [authorsText, setAuthorsText] = useState('');
  const [year, setYear] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthorsText(authorsToText(initialBiblio?.author));
    setYear(initialBiblio?.issued?.year ? String(initialBiblio.issued.year) : '');
    setTitle(initialBiblio?.title || '');
  }, [initialBiblio]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const authors = parseAuthorsText(authorsText);
      const trimmedYear = year.trim();
      const yearNum = trimmedYear ? parseInt(trimmedYear, 10) : NaN;
      const nextCsl: DocumentBiblioCsl = {
        ...(initialBiblio || {}),
        title: title.trim() || undefined,
        author: authors.length > 0 ? authors : undefined,
        issued: trimmedYear && !Number.isNaN(yearNum) ? { year: yearNum } : undefined,
      };
      const saved = await updateDocumentBiblio(documentId, nextCsl);
      onSaved(saved.cslJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : tOr('quoteFinder.biblioSaveError', 'Failed to save citation info'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/34 px-3 py-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="biblio-form-title">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--reader-border)] px-5 py-4">
          <h2 id="biblio-form-title" className="text-base font-semibold">
            {tOr('quoteFinder.biblioTitle', 'Citation info for this document')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-panel-muted)] hover:text-[var(--reader-ink)] focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={tOr('common.close', 'Close')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-4 px-5 py-5">
            <p className="text-xs leading-5 text-[var(--reader-muted)]">
              {tOr('quoteFinder.biblioHint', 'Used to build the "(Author, Year, p. X)" citation the Copy button attaches to each quote. Only your own edits are saved — other readers of this document keep their own.')}
            </p>
            <label className="block">
              <span className="text-sm font-medium">{tOr('quoteFinder.biblioAuthors', 'Author(s)')}</span>
              <textarea
                value={authorsText}
                onChange={(e) => setAuthorsText(e.target.value)}
                rows={3}
                placeholder={tOr('quoteFinder.biblioAuthorsPlaceholder', 'Family, Given\nOne per line')}
                className="mt-2 w-full resize-y rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 py-2 text-sm text-[var(--reader-ink)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium">{tOr('quoteFinder.biblioYear', 'Year')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  maxLength={4}
                  placeholder={tOr('quoteFinder.biblioYearPlaceholder', 'e.g. 2021')}
                  className="mt-2 w-full rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 py-2 text-sm text-[var(--reader-ink)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">{tOr('quoteFinder.biblioTitleField', 'Title')}</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={300}
                  className="mt-2 w-full rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 py-2 text-sm text-[var(--reader-ink)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </label>
            </div>
            {error ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--reader-border)] px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--reader-border)] px-4 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {tOr('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {saving ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {saving ? tOr('quoteFinder.biblioSaving', 'Saving...') : tOr('quoteFinder.biblioSave', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
