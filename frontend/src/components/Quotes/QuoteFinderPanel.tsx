"use client";

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { useLocale } from '../../i18n';
import { ApiError, searchDocumentQuotes } from '../../lib/api';
import type { QuoteCard, QuoteSearchResult } from '../../lib/api';
import type { Citation } from '../../types';
import { PaywallModal } from '../PaywallModal';
import { openAuthModal } from '../../lib/auth-modal';
import { errorCopy } from '../../lib/errorCopy';
import { trackEvent } from '../../lib/analytics';
import { citationFromQuoteCard } from './utils';
import QuoteCardList from './QuoteCardList';

interface QuoteFinderPanelProps {
  isOpen: boolean;
  documentId: string;
  userPlan?: string;
  onClose: () => void;
  onCitationClick: (citation: Citation) => void;
  /** Prefills the topic input on open (FIX3-B "Try Quote Finder" chip) — the
   * search itself is never auto-triggered from this; the user must still
   * submit (or edit first), since this action is billed. Undefined for the
   * plain toolbar entry point, which always opens with an empty topic. */
  initialTopic?: string;
}

/**
 * "Quote Finder" — a deliberate, billed action on the current document
 * (plan §8.4.1: predebit 15 credits, reconciled to actual tokens, charged
 * even on a verified-empty result). Distinct from ordinary chat: every
 * card is machine-verified against the source text before ever reaching
 * the UI (backend `quote_search_service`), never an LLM paraphrase — see
 * the honest empty-state copy below. The strong "word-for-word" claim is
 * NOT unconditional, though (Codex M2 r1 BLOCKER #1): only page_text-kind
 * results can promise byte-identical wording — extracted_text-kind
 * (chunk-fallback) results carry an explicit hyphenation caveat instead.
 * See `resultKindHeadline`/`trustLabel` in `Quotes/utils.ts`, both
 * rendered inside `QuoteCardList` so this panel and the chat artifact
 * (F3) stay consistent.
 */
export default function QuoteFinderPanel({ isOpen, documentId, userPlan, onClose, onCitationClick, initialTopic }: QuoteFinderPanelProps) {
  const { t, tOr, locale } = useLocale();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteSearchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped every time the panel (re)opens or is retargeted to a new
  // initialTopic while already open (Codex r4 new-breakage). handleSearch
  // captures the generation it started under; if it changes before the
  // request resolves, the response is stale and must not populate the new
  // view — same compare-on-resolve pattern as useChatStream's
  // demoAccountingEpoch reanchor guard.
  const openGenerationRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    openGenerationRef.current += 1;
    // Reset on EVERY open (and every retarget while already open): a
    // previous open's topic/result/error must never bleed into this one —
    // e.g. opening via a "Try Quote Finder" chip for topic B must not show
    // topic A's cards under B's prefilled input. `loading` must reset too
    // (Codex r5): bumping the generation above makes a still-running
    // previous search's generation-guarded `finally` correctly refuse to
    // clear it, so without this the panel is left permanently wedged in
    // "Searching..." with the submit button disabled.
    setTopic(initialTopic ?? '');
    setResult(null);
    setErrorMsg(null);
    setLoading(false);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(id);
  }, [isOpen, initialTopic]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || loading) return;
    // Captured now so a LATER open/retarget (which bumps the ref) can be
    // detected when this request resolves — see openGenerationRef above.
    const generation = openGenerationRef.current;
    setLoading(true);
    setErrorMsg(null);
    // Fires on SUBMIT, before the request — not after success (Codex M2 r1
    // finding #6: firing only on success made every failed/paywalled search
    // invisible to the funnel). No result-dependent properties here since
    // none exist yet; the backend's own quote_search_completed event
    // (unchanged) carries the verified/discarded counts server-side.
    trackEvent('quote_search_submitted', { source: 'quote_finder_panel' });
    try {
      const res = await searchDocumentQuotes(documentId, trimmed, locale);
      if (openGenerationRef.current !== generation) return; // stale — panel reopened/retargeted since this search started
      setResult(res);
    } catch (err) {
      if (openGenerationRef.current !== generation) return; // stale — don't paywall/auth-redirect/error a view the user has since left
      if (err instanceof ApiError && err.status === 402) {
        setPaywallReason(err.code || 'credits');
        setPaywallOpen(true);
        trackEvent('paywall_opened', {
          source: 'quote_finder_panel',
          reason: err.code || 'credits',
          plan: userPlan || 'free',
          period: 'monthly',
        });
      } else if (err instanceof ApiError && err.status === 401) {
        onClose();
        openAuthModal();
      } else {
        const copy = errorCopy(err, t, tOr);
        setErrorMsg(copy.body || copy.title);
      }
    } finally {
      if (openGenerationRef.current === generation) {
        setLoading(false);
      }
    }
  };

  const handleJump = (card: QuoteCard, index: number) => {
    onCitationClick(citationFromQuoteCard(card, documentId, index));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/34 px-3 py-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="quote-finder-title">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-2xl max-h-[85vh]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--reader-border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--reader-muted)]">
              {tOr('quoteFinder.eyebrow', 'Verbatim quotes')}
            </p>
            <h2 id="quote-finder-title" className="mt-1 text-lg font-semibold">
              {tOr('quoteFinder.title', 'Quote Finder')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-panel-muted)] hover:text-[var(--reader-ink)] focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={tOr('common.close', 'Close')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSearch(e)} className="flex items-center gap-2 border-b border-[var(--reader-border)] px-5 py-3">
          <input
            ref={inputRef}
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={300}
            placeholder={tOr('quoteFinder.topicPlaceholder', 'What should the quote be about?')}
            className="min-h-10 flex-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 text-sm text-[var(--reader-ink)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {loading ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
            {loading ? tOr('quoteFinder.searching', 'Searching...') : tOr('quoteFinder.searchButton', 'Find quotes')}
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {errorMsg ? (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200" role="alert">
              {errorMsg}
            </p>
          ) : null}

          {!result && !loading ? (
            <p className="text-sm leading-6 text-[var(--reader-muted)]">
              {tOr('quoteFinder.intro', "Enter a topic and DocTalk searches this document for quotes, each one machine-verified against the source text before it's shown.")}
            </p>
          ) : null}

          {result && result.cards.length === 0 ? (
            <p className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 py-3 text-sm leading-6 text-[var(--reader-muted)]" role="status">
              {tOr(
                'quoteFinder.emptyState',
                "No verified quotes found for this topic (scanned {n} passages). DocTalk only shows quotes it can verify against the source text — try a more specific topic.",
                { n: result.scannedChunks },
              )}
            </p>
          ) : null}

          {result && result.cards.length > 0 ? (
            <QuoteCardList
              documentId={documentId}
              cards={result.cards}
              onJump={handleJump}
              allowEditBiblio
              summaryLine={tOr(
                'quoteFinder.resultsSummary',
                '{verified} verified · {discarded} discarded',
                { verified: result.verified, discarded: result.discardedCount },
              )}
            />
          ) : null}
        </div>
      </div>

      <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} reason={paywallReason} currentPlan={userPlan} />
    </div>
  );
}
