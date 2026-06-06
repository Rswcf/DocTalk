"use client";

import { useEffect, useMemo, useState } from 'react';
import { FilePlus2, Languages, Loader2, X } from 'lucide-react';
import { useLocale } from '../../i18n';
import { LAYOUT_TRANSLATION_TARGETS } from '../../lib/layoutTranslation';

interface LayoutTranslationDrawerProps {
  isOpen: boolean;
  busy: boolean;
  documentName?: string | null;
  pageCount?: number;
  userPlan?: string;
  onClose: () => void;
  onSubmit: (options: { targetLanguage: string; addToLibrary: boolean }) => void;
}

function maxPagesForPlan(plan?: string): number {
  const normalized = (plan || 'free').toLowerCase();
  if (normalized === 'pro') return 300;
  if (normalized === 'plus') return 150;
  return 25;
}

export default function LayoutTranslationDrawer({
  isOpen,
  busy,
  documentName,
  pageCount,
  userPlan,
  onClose,
  onSubmit,
}: LayoutTranslationDrawerProps) {
  const { tOr } = useLocale();
  const [targetLanguage, setTargetLanguage] = useState('zh-CN');
  const [addToLibrary, setAddToLibrary] = useState(false);
  const maxPages = maxPagesForPlan(userPlan);
  const pageLimitExceeded = typeof pageCount === 'number' && pageCount > 0 && pageCount > maxPages;
  const planLabel = (userPlan || 'free').toLowerCase();

  useEffect(() => {
    if (!isOpen) return;
    setAddToLibrary(false);
  }, [isOpen]);

  const selectedTarget = useMemo(
    () => LAYOUT_TRANSLATION_TARGETS.find((target) => target.value === targetLanguage) || LAYOUT_TRANSLATION_TARGETS[0],
    [targetLanguage],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/34 px-3 py-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--reader-border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--reader-muted)]">
              {tOr('layoutTranslation.drawerEyebrow', 'PDF translation')}
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {tOr('layoutTranslation.drawerTitle', 'Create a translated PDF')}
            </h2>
            <p className="mt-1 truncate text-sm text-[var(--reader-muted)]">
              {documentName || tOr('layoutTranslation.currentDocument', 'Current document')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--reader-muted)] transition-colors hover:bg-[var(--reader-panel-muted)] hover:text-[var(--reader-ink)] focus-visible:ring-2 focus-visible:ring-zinc-400"
            aria-label={tOr('common.close', 'Close')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <label className="block">
            <span className="text-sm font-medium">
              {tOr('layoutTranslation.targetLanguage', 'Target language')}
            </span>
            <select
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 py-2 text-sm text-[var(--reader-ink)] outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              {LAYOUT_TRANSLATION_TARGETS.map((target) => (
                <option key={target.value} value={target.value}>{target.label}</option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-4 py-3">
            <input
              type="checkbox"
              checked={addToLibrary}
              onChange={(event) => setAddToLibrary(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[var(--reader-border)]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <FilePlus2 size={15} aria-hidden="true" />
                {tOr('layoutTranslation.addToLibrary', 'Also create a new DocTalk document')}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--reader-muted)]">
                {tOr('layoutTranslation.addToLibraryHint', 'When the translated PDF is ready, DocTalk will parse it so you can chat with the translated version.')}
              </span>
            </span>
          </label>

          <div className={`rounded-xl border px-4 py-3 text-sm ${
            pageLimitExceeded
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100'
              : 'border-[var(--reader-border)] bg-[var(--reader-panel-muted)] text-[var(--reader-muted)]'
          }`}>
            <div className="flex items-center gap-2 font-medium text-[var(--reader-ink)]">
              <Languages size={15} aria-hidden="true" />
              {selectedTarget.label}
            </div>
            <p className="mt-1 leading-5">
              {tOr(
                'layoutTranslation.limitNote',
                '{plan} plan: up to {maxPages} pages per translated PDF. Free includes 2 trials.',
                { plan: planLabel, maxPages },
              )}
              {typeof pageCount === 'number' && pageCount > 0 ? ` ${tOr('layoutTranslation.thisPdfPages', 'This PDF has {pages} pages.', { pages: pageCount })}` : ''}
            </p>
            {pageLimitExceeded ? (
              <p className="mt-2 font-medium">
                {tOr('layoutTranslation.pageLimitExceeded', 'This PDF is above your current plan limit.')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--reader-border)] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--reader-border)] px-4 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {tOr('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ targetLanguage, addToLibrary })}
            disabled={busy || pageLimitExceeded}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Languages size={16} aria-hidden="true" />}
            {busy ? tOr('layoutTranslation.starting', 'Starting...') : tOr('layoutTranslation.startButton', 'Start translation')}
          </button>
        </div>
      </div>
    </div>
  );
}
