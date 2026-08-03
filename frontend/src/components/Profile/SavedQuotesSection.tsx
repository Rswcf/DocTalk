"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useLocale } from "../../i18n";
import { ApiError, deleteSavedQuote, listAllSavedQuotes } from "../../lib/api";
import type { SavedQuote } from "../../lib/api";
import { pageRangeLabel, tierLabel, trustLabel } from "../Quotes/utils";

function SavedQuoteRow({
  quote,
  onDeleted,
}: {
  quote: SavedQuote;
  onDeleted: (id: string) => void;
}) {
  const { tOr } = useLocale();
  const documentName = quote.documentFilename || tOr("profile.savedQuotes.unknownDocument", "Untitled document");
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopy = async () => {
    // Lightweight-integration choice (see SavedQuotesSection docstring): a
    // plain quote-text copy, no APA citation — building a per-document
    // biblio cache for a list that can span every document the user owns
    // is exactly the complexity this board is meant to avoid in v1.
    try {
      await navigator.clipboard.writeText(quote.quoteText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // best-effort, no toast
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteSavedQuote(quote.id);
      onDeleted(quote.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        onDeleted(quote.id);
        return;
      }
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/d/${quote.documentId}?page=${quote.page}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <ExternalLink size={12} aria-hidden="true" />
          {documentName}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">·</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{pageRangeLabel(quote, tOr)}</span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {tierLabel(quote.tier, tOr)}
        </span>
        <span
          className={
            quote.sourceKind === "page_text"
              ? "text-[11px] text-zinc-500 dark:text-zinc-400"
              : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          }
        >
          {trustLabel(quote.sourceKind, tOr)}
        </span>
      </div>

      <blockquote className="mt-2 border-l-2 border-blue-600 pl-3 text-sm italic leading-relaxed text-zinc-900 dark:border-blue-400 dark:text-zinc-100">
        &ldquo;{quote.quoteText}&rdquo;
      </blockquote>

      {quote.note ? (
        <p className="mt-2 rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs leading-5 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          {quote.note}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          {copied ? tOr("quoteFinder.copied", "Copied") : tOr("quoteFinder.copyText", "Copy quote")}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          aria-label={tOr("quoteFinder.delete", "Delete")}
          title={tOr("quoteFinder.delete", "Delete")}
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
        >
          {deleting ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

/**
 * The all-documents Evidence Board (M3-F2's "lightweight" half). Chose a
 * new tab in the existing Profile page over a standalone route: the
 * profile already has an established tabbed-sections pattern (Profile /
 * Credits / Usage / Account / Notifications, see ProfileTabs.tsx) with its
 * own auth guard and layout, and "every saved quote across all my
 * documents" reads naturally as an account-level view alongside Credits/
 * Usage rather than a document-scoped one — a new top-level route would
 * duplicate that auth+layout scaffolding for no real benefit.
 *
 * Deliberately lighter than the per-document Saved tab inside Quote
 * Finder (SavedQuoteList/SavedQuoteCard): read-only note display (no
 * inline edit — that's a document-in-context action), plain "Copy quote"
 * with no APA citation (avoids needing a biblio fetch per distinct
 * document in the list), and "Open document" just links to the right
 * page rather than restoring the fine-grained bbox highlight (that needs
 * a live store, which only exists on the document reader route). Delete
 * is still included since it's useful from anywhere and cheap either way.
 */
const FREE_SAVED_QUOTES_LIMIT = 30;

export default function SavedQuotesSection({ userPlan }: { userPlan?: string }) {
  const { t, tOr } = useLocale();
  const [quotes, setQuotes] = useState<SavedQuote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Codex M3 r1 FIX-7: the board feed now resolves each row's document
    // name server-side (document_filename, query-time join) instead of
    // this component cross-referencing its own getMyDocuments() list —
    // that list was capped at 50 documents and excluded demo docs, so a
    // saved quote from doc #51 or a demo document always rendered
    // "Untitled document" regardless of its real name.
    listAllSavedQuotes()
      .then((savedQuotes) => {
        if (!cancelled) setQuotes(savedQuotes);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleted = (id: string) => {
    setQuotes((prev) => (prev ? prev.filter((q) => q.id !== id) : prev));
  };

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("common.loading")}</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
        {t("error.somethingWrong")}
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <Bookmark aria-hidden size={28} className="mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {tOr("profile.savedQuotes.emptyTitle", "No saved quotes yet")}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {tOr("profile.savedQuotes.emptyBody", "Save verified quotes from any document's Quote Finder panel to build your research library here.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {tOr("profile.savedQuotes.count", "{count} saved quotes", { count: quotes.length })}
        </p>
        {(userPlan || "free") === "free" ? (
          // M3-F3: this board's own fetch already returns the TRUE global
          // count (it's the same GET /api/quotes the cap itself is
          // enforced against), so unlike the per-document panel tab, no
          // extra request is needed here to show it honestly.
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {tOr("quoteFinder.capIndicator", "{count} of {limit} saved", { count: quotes.length, limit: FREE_SAVED_QUOTES_LIMIT })}
          </p>
        ) : null}
      </div>
      <div className="space-y-3">
        {quotes.map((quote) => (
          <SavedQuoteRow
            key={quote.id}
            quote={quote}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  );
}
