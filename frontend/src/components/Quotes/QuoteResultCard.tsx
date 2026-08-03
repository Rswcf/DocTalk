"use client";

import { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Check, Copy, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../i18n';
import { ApiError, saveQuote } from '../../lib/api';
import type { DocumentBiblioCsl, QuoteCard } from '../../lib/api';
import { formatApaInText } from '../../lib/apaFormat';
import { approxHighlightLabel, pageRangeLabel, tierLabel, trustLabel } from './utils';

interface QuoteResultCardProps {
  card: QuoteCard;
  index: number;
  documentId: string;
  biblio: DocumentBiblioCsl | null;
  onJump: (card: QuoteCard, index: number) => void;
  /** Fired on a 403 SAVED_QUOTES_LIMIT_REACHED — the card itself never owns
   * a PaywallModal (there can be many cards in a list); the shared list
   * container (QuoteCardList) owns exactly one instance. */
  onSaveLimitReached?: (detail: { limit: number; plan: string }) => void;
}

export default function QuoteResultCard({ card, index, documentId, biblio, onJump, onSaveLimitReached }: QuoteResultCardProps) {
  const { tOr } = useLocale();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Belt-and-braces (Codex M3 r2 finding #4): the full-identity key on the
  // list side (quoteResultCardKey — chunkId/page/pageEnd/full text) should
  // already force a remount whenever the underlying quote actually
  // changes, but resetting saved/saving directly off the identity-defining
  // props too means a residual key collision (or a future refactor that
  // drops the key discipline) still can't leave a stale saved=true state
  // attached to different text.
  useEffect(() => {
    setSaved(false);
    setSaving(false);
  }, [card.chunkId, card.page, card.pageEnd, card.displayText]);

  // A SECOND belt-and-braces layer (Codex M3 r3 #4): the effect above
  // resets state on an identity change, but handleSave's own `await` can
  // still be in flight when that happens, and its OWN closure still holds
  // the OLD `card` — so the effect resetting `saved` to false doesn't stop
  // that stale call from setting it right back to `true` once its promise
  // resolves. `latestIdentity` is recomputed on every render and mirrored
  // into a ref DURING render (not via an effect, which would lag one
  // render behind) so a save started under an OLD identity can compare
  // against whatever the LATEST render's identity actually is, at the
  // moment its await resolves — not just what its own stale closure
  // remembers.
  const latestIdentity = `${card.chunkId}|${card.page}|${card.pageEnd}|${card.displayText}`;
  const latestIdentityRef = useRef(latestIdentity);
  latestIdentityRef.current = latestIdentity;

  const handleCopy = async () => {
    const apaInText = formatApaInText(biblio, card.page, card.pageEnd);
    const text = `"${card.displayText}" ${apaInText}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked in non-secure contexts / permission
      // denial — best-effort, no toast (the missing "Copied" state is
      // itself the "didn't work" cue, matching MessageBubble's copy button).
    }
  };

  const handleSave = async () => {
    // Idempotent at the UI level too: once this card instance is marked
    // saved locally, further clicks no-op without a network round trip
    // (the backend is itself idempotent — re-POSTing returns the existing
    // row — this just avoids the redundant call).
    if (saved || saving) return;
    // Captured now — Codex M3 r3 #4 belt-and-braces: compared against
    // `latestIdentityRef.current` AFTER the await, before setSaved(true),
    // so a save that started for one quote can never mark a DIFFERENT
    // quote "saved" if this component instance ends up showing different
    // data (e.g. a residual key collision, or a future refactor that
    // loosens key discipline) by the time the request resolves.
    const identityAtStart = latestIdentity;
    setSaving(true);
    try {
      await saveQuote(documentId, { chunkId: card.chunkId, quoteText: card.displayText, pageHint: card.page });
      if (latestIdentityRef.current !== identityAtStart) return; // this instance now shows different card data — the save it just ran no longer describes it
      setSaved(true);
    } catch (err) {
      if (latestIdentityRef.current !== identityAtStart) return; // stale — don't surface a paywall (or any other state) for a card the user isn't looking at anymore
      if (err instanceof ApiError && err.status === 403 && err.code === 'SAVED_QUOTES_LIMIT_REACHED') {
        const limit = typeof err.detail.limit === 'number' ? err.detail.limit : 30;
        const plan = typeof err.detail.plan === 'string' ? err.detail.plan : 'free';
        onSaveLimitReached?.({ limit, plan });
      }
      // Other failures (network, a 422 the search result shouldn't normally
      // trigger since it was just verified) — best-effort, no dedicated
      // inline error UI for v1; the button simply stays in its unsaved
      // state so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldCheck size={12} aria-hidden="true" />
          {tOr('quoteFinder.verifiedBadge', 'Verified')}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {tierLabel(card.tier, tOr)}
        </span>
        <span
          className={
            card.sourceKind === 'page_text'
              ? 'text-[11px] text-[var(--reader-muted)]'
              : 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
          }
        >
          {trustLabel(card.sourceKind, tOr)}
        </span>
      </div>

      <blockquote className="mt-2 border-l-2 border-blue-600 pl-3 text-sm italic leading-relaxed text-[var(--reader-ink)] dark:border-blue-400">
        &ldquo;{card.displayText}&rdquo;
      </blockquote>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[var(--reader-muted)]">
          <MapPin size={12} aria-hidden="true" />
          <span>{pageRangeLabel(card, tOr)}</span>
          <span aria-hidden="true">·</span>
          <span>{approxHighlightLabel(tOr)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onJump(card, index)}
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
            onClick={() => void handleSave()}
            disabled={saving}
            aria-pressed={saved}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed ${
              saved
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300'
                : 'border-[var(--reader-border)] bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] hover:bg-[var(--reader-panel-muted)]'
            }`}
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : saved ? (
              <BookmarkCheck size={12} aria-hidden="true" />
            ) : (
              <Bookmark size={12} aria-hidden="true" />
            )}
            {saved ? tOr('quoteFinder.saved', 'Saved') : tOr('quoteFinder.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
