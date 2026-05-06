"use client";

import React from 'react';
import { ExternalLink, FileText, Plus } from 'lucide-react';
import type { CollectionDocumentBrief } from '../../types';
import { useLocale } from '../../i18n';

interface CollectionSidebarProps {
  documents: CollectionDocumentBrief[];
  onAddDocs: () => void;
  onOpenDoc: (docId: string) => void;
}

export default function CollectionSidebar({ documents, onAddDocs, onOpenDoc }: CollectionSidebarProps) {
  const { tOr } = useLocale();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {tOr('collections.documents', 'Documents')} ({documents.length})
        </h3>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {documents.map((doc) => (
          <button
            type="button"
            key={doc.id}
            onClick={() => onOpenDoc(doc.id)}
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
          >
            <FileText size={14} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{doc.filename}</span>
            <ExternalLink size={10} className="text-zinc-400 shrink-0 ml-auto" />
          </button>
        ))}
        {documents.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center dark:border-zinc-700">
            <FileText aria-hidden="true" size={20} className="mx-auto mb-2 text-zinc-400" />
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {tOr('collections.noDocumentsInCollection', 'No documents in this collection yet.')}
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={onAddDocs}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
        >
          <Plus size={12} /> {tOr('collections.addDocuments', 'Add documents')}
        </button>
      </div>
    </div>
  );
}
