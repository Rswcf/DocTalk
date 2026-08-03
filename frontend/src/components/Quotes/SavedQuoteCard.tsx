"use client";

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, MapPin, Trash2 } from 'lucide-react';
import { useLocale } from '../../i18n';
import { ApiError, deleteSavedQuote, updateSavedQuoteNote } from '../../lib/api';
import type { DocumentBiblioCsl, SavedQuote } from '../../lib/api';
import { formatApaInText } from '../../lib/apaFormat';
import { pageRangeLabel, tierLabel, trustLabel } from './utils';

interface SavedQuoteCardProps {
  quote: SavedQuote;
  index: number;
  biblio: DocumentBiblioCsl | null;
  onJump: (quote: SavedQuote, index: number) => void;
  onDeleted: (quoteId: string) => void;
  /** Fired with the server-confirmed row after a successful note PATCH, so
   * the parent list's own `quotes` array stays the source of truth (Codex
   * M3 r1 finding #3). */
  onNoteUpdated: (quote: SavedQuote) => void;
}

/**
 * A single saved quote in the Evidence Board (M3-F2). Renders the STORED
 * snapshot fields (tier/score/source_kind taken at save time) — never
 * re-verifies, matching the backend's own no-reverification-on-read
 * guarantee (wave-m3-backend-report.md's B3 section): a saved quote's
 * trust labels can go visually stale relative to a since-reparsed
 * document, which is intentional v1 scope, not a bug.
 */
export default function SavedQuoteCard({ quote, index, biblio, onJump, onDeleted, onNoteUpdated }: SavedQuoteCardProps) {
  const { tOr } = useLocale();
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(quote.note || '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The last note value CONFIRMED by a successful PATCH (or the initial
  // load) — compared against on blur instead of the `quote` prop (Codex M3
  // r1 finding #3): the prop only updates once the parent re-renders with
  // the bubbled-up `onNoteUpdated` result, so comparing against it directly
  // caused a redundant PATCH on every blur even when nothing had changed
  // since the last successful save. A ref, not state: read/written inside
  // an async chain (runNoteSave below) where a stale render's closure over
  // state would be wrong.
  const confirmedNoteRef = useRef(quote.note || '');
  // Serializes note PATCHes to a single in-flight request per card (Codex
  // M3 r2 finding #3, r1's generation-guard only ignored a stale RESPONSE
  // client-side — it never stopped two requests from being in flight
  // together, so the backend's unconditional last-COMMIT-wins could still
  // let an older PATCH persist over a newer one if it happened to reach
  // Postgres second). While `inFlightRef` is true, a blur only records its
  // value in `pendingValueRef` (overwriting any earlier queued value —
  // only the latest ever matters) instead of dispatching; the in-flight
  // request's `finally` drains exactly one queued value, so out-of-order
  // commits are now structurally impossible from this client. Cross-tab or
  // cross-device simultaneous edits are NOT covered by this — the backend
  // stays plain last-write-wins across independent clients, which is the
  // accepted v1 semantic (single-user note field, low real-world contest
  // rate outside this exact race).
  const inFlightRef = useRef(false);
  const pendingValueRef = useRef<string | null>(null);

  // The quote object is the parent's source of truth; re-sync the local
  // draft if it changes out from under us (e.g. a PATCH from elsewhere).
  useEffect(() => {
    setNote(quote.note || '');
    confirmedNoteRef.current = quote.note || '';
  }, [quote.id, quote.note]);

  const runNoteSave = async (value: string) => {
    inFlightRef.current = true;
    setSavingNote(true);
    setNoteError(false);
    try {
      const updated = await updateSavedQuoteNote(quote.id, value || null);
      confirmedNoteRef.current = updated.note || '';
      setNote(updated.note || '');
      onNoteUpdated(updated);
    } catch {
      // Revert to the last CONFIRMED value so the textarea doesn't
      // silently claim a save that didn't happen.
      setNote(confirmedNoteRef.current);
      setNoteError(true);
    } finally {
      setSavingNote(false);
      inFlightRef.current = false;
      const queued = pendingValueRef.current;
      pendingValueRef.current = null;
      // Drain exactly one queued value — if it still differs from what's
      // now confirmed, this recursive call becomes the new (and only)
      // in-flight request; any further blurs during ITS flight queue
      // behind it the same way.
      if (queued !== null && queued !== confirmedNoteRef.current) {
        void runNoteSave(queued);
      }
    }
  };

  const handleCopy = async () => {
    const apaInText = formatApaInText(biblio, quote.page, quote.pageEnd);
    const text = `"${quote.quoteText}" ${apaInText}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Best-effort, no toast — matches QuoteResultCard's copy handling.
    }
  };

  const handleNoteBlur = () => {
    const trimmed = note.trim();
    // Check in-flight FIRST (Codex M3 r3 #3 — order of checks matters).
    // Failure trace with the old order (no-op check before in-flight
    // check): confirmed A -> PATCH B dispatched (in flight) -> user edits
    // back to A and blurs -> `trimmed === confirmedNoteRef.current` was
    // still true (confirmed hadn't moved past A yet) -> early return, A
    // never queued -> B lands and wrongly becomes final, silently
    // discarding the user's real "back to A" edit. ALWAYS queue while a
    // save is in flight, even when `trimmed` equals the CURRENT
    // (soon-to-be-stale) confirmed value — runNoteSave's drain step
    // re-evaluates "differs from confirmed" against whatever confirmed
    // becomes once the in-flight request resolves, which is the only
    // point where that comparison is actually meaningful.
    if (inFlightRef.current) {
      pendingValueRef.current = trimmed; // queue the latest — overwrites any earlier queued value
      return;
    }
    if (trimmed === confirmedNoteRef.current) return; // no-op PATCH avoidance — nothing in flight, so this IS the current confirmed value
    void runNoteSave(trimmed);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteSavedQuote(quote.id);
      onDeleted(quote.id);
    } catch (err) {
      // 404 SAVED_QUOTE_NOT_FOUND means it's already gone (e.g. deleted
      // from another tab) — treat that as success rather than leaving a
      // ghost row the user can't get rid of.
      if (err instanceof ApiError && err.status === 404) {
        onDeleted(quote.id);
        return;
      }
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {tierLabel(quote.tier, tOr)}
        </span>
        <span
          className={
            quote.sourceKind === 'page_text'
              ? 'text-[11px] text-[var(--reader-muted)]'
              : 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
          }
        >
          {trustLabel(quote.sourceKind, tOr)}
        </span>
      </div>

      <blockquote className="mt-2 border-l-2 border-blue-600 pl-3 text-sm italic leading-relaxed text-[var(--reader-ink)] dark:border-blue-400">
        &ldquo;{quote.quoteText}&rdquo;
      </blockquote>

      <div className="mt-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          maxLength={2000}
          rows={2}
          placeholder={tOr('quoteFinder.notePlaceholder', 'Add a note...')}
          aria-label={tOr('quoteFinder.notePlaceholder', 'Add a note...')}
          className="w-full resize-y rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2.5 py-1.5 text-xs text-[var(--reader-ink)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        {savingNote ? (
          <p className="mt-1 text-[11px] text-[var(--reader-muted)]">{tOr('quoteFinder.noteSaving', 'Saving note...')}</p>
        ) : noteError ? (
          <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">{tOr('quoteFinder.noteSaveError', 'Failed to save note')}</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[var(--reader-muted)]">
          <MapPin size={12} aria-hidden="true" />
          <span>{pageRangeLabel(quote, tOr)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onJump(quote, index)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2.5 text-xs font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <MapPin size={12} aria-hidden="true" />
            {tOr('quoteFinder.jump', 'Jump to page')}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2.5 text-xs font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            {copied ? tOr('quoteFinder.copied', 'Copied') : tOr('quoteFinder.copy', 'Copy quote + citation')}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label={tOr('quoteFinder.delete', 'Delete')}
            title={tOr('quoteFinder.delete', 'Delete')}
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] text-[var(--reader-muted)] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
          >
            {deleting ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
