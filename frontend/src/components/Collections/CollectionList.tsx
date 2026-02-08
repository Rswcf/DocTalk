"use client";

import React from 'react';
import Link from 'next/link';
import { Trash2, FolderOpen } from 'lucide-react';
import { useLocale } from '../../i18n';
import type { CollectionBrief } from '../../types';

interface Props {
  collections: CollectionBrief[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}

export default function CollectionList({ collections, onDelete, deletingId }: Props) {
  const { t } = useLocale();

  if (collections.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">{t('collections.noCollections')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {collections.map((c) => (
        <div
          key={c.id}
          className="p-5 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
        >
          <Link href={`/collections/${c.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <FolderOpen size={20} className="text-zinc-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {c.name}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {t('collections.documentCount', { count: c.document_count })} &middot; {new Date(c.created_at).toLocaleDateString()}
                </div>
                {c.description && (
                  <div className="text-xs text-zinc-400 mt-1 truncate">{c.description}</div>
                )}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
            <Link
              href={`/collections/${c.id}`}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors"
            >
              {t('doc.open')}
            </Link>
            <button
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors disabled:opacity-50"
              disabled={deletingId === c.id}
              onClick={() => {
                if (window.confirm(t('collections.deleteConfirm'))) {
                  onDelete(c.id);
                }
              }}
              title={t('collections.delete')}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
