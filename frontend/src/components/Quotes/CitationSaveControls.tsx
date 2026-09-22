"use client";

import { BookmarkCheck, BookmarkPlus } from 'lucide-react';
import { useLocale } from '../../i18n';
import type { SavedQuote } from '../../lib/api';
import { tierLabel, trustLabel } from './utils';

/**
 * "Save quote" in the reader's evidence bar (lib/citationSave.ts has the
 * decisions). Presentational only: the reader owns the state and the handler.
 *
 * The notice renders the row the server returned after re-verifying the save,
 * never the sentence the client sent, and labels it per source kind (a
 * word-for-word claim only for page_text). The button is disabled only while
 * a save is in flight: the cap is the server's to enforce, and re-saving a
 * saved quote always succeeds.
 */
export type CitationSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; quote: SavedQuote }
  | { status: 'error'; message: string };

export function CitationSaveButton({ state, onSave }: { state: CitationSaveState; onSave: () => void }) {
  const { tOr } = useLocale();
  const saved = state.status === 'saved';
  const label = state.status === 'saving'
    ? tOr('evidence.quoteSaving', 'Saving…')
    : saved
      ? tOr('evidence.quoteSavedShort', 'Saved')
      : tOr('evidence.saveQuote', 'Save quote');
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={state.status === 'saving'}
      aria-busy={state.status === 'saving'}
      title={tOr('evidence.saveQuoteHint', 'Save this supporting sentence as a verified quote')}
      className="flex min-h-9 items-center gap-1.5 rounded px-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10 disabled:opacity-50"
    >
      {saved ? <BookmarkCheck size={14} aria-hidden="true" /> : <BookmarkPlus size={14} aria-hidden="true" />}
      {label}
    </button>
  );
}

export function CitationSaveNotice({ state }: { state: CitationSaveState }) {
  const { tOr } = useLocale();
  if (state.status === 'saved') {
    return (
      <p role="status" className="basis-full min-w-0 text-zinc-700 dark:text-zinc-300">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {tOr('evidence.quoteSaved', 'Saved as a verified quote')}
        </span>
        {' · '}
        {tierLabel(state.quote.tier, tOr)}
        {' · '}
        {trustLabel(state.quote.sourceKind, tOr)}
        <span className="mt-0.5 block line-clamp-2">&ldquo;{state.quote.quoteText}&rdquo;</span>
      </p>
    );
  }
  if (state.status === 'error') {
    return <p role="alert" className="basis-full min-w-0 text-red-700 dark:text-red-400">{state.message}</p>;
  }
  return null;
}
