"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, FileText, FolderOpen, Trash2 } from 'lucide-react';
import { useLocale } from '../../i18n';
import type { CollectionBrief } from '../../types';

interface Props {
  collections: CollectionBrief[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}

export default function CollectionList({ collections, onDelete, deletingId }: Props) {
  const { t, tOr } = useLocale();

  if (collections.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">{t('collections.noCollections')}</p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {collections.map((c) => (
        <article
          key={c.id}
          className="group flex min-h-[210px] flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-accent dark:border-zinc-800 dark:bg-zinc-950">
                <FolderOpen aria-hidden="true" size={19} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {c.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-300 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              disabled={deletingId === c.id}
              onClick={() => {
                if (window.confirm(t('collections.deleteConfirm'))) {
                  onDelete(c.id);
                }
              }}
              title={t('collections.delete')}
              aria-label={t('collections.delete')}
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>

          <p className="mt-4 line-clamp-2 min-h-[40px] text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {c.description || tOr('collections.noDescription', 'No description yet. Use this workspace to keep related documents together.')}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <FileText aria-hidden="true" size={15} />
                <span className="text-xs font-medium">{tOr('collections.documents', 'Documents')}</span>
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {c.document_count.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {tOr('collections.status', 'Status')}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {tOr('collections.ready', 'Ready')}
              </div>
            </div>
          </div>

          <Link
            href={`/collections/${c.id}`}
            className="mt-auto inline-flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-700 transition-colors group-hover:text-accent dark:border-zinc-800 dark:text-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
          >
            <span>{t('doc.open')}</span>
            <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
          </Link>
        </article>
      ))}
    </div>
  );
}
