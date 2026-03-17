"use client";

import React from 'react';
import { ExternalLink, FileText, Plus } from 'lucide-react';
import type { CollectionDocumentBrief } from '../../types';

interface CollectionSidebarProps {
  documents: CollectionDocumentBrief[];
  onAddDocs: () => void;
  onOpenDoc: (docId: string) => void;
}

export default function CollectionSidebar({ documents, onAddDocs, onOpenDoc }: CollectionSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Documents ({documents.length})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onOpenDoc(doc.id)}
            className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
          >
            <FileText size={14} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{doc.filename}</span>
            <ExternalLink size={10} className="text-zinc-400 shrink-0 ml-auto" />
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onAddDocs}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
        >
          <Plus size={12} /> Add Documents
        </button>
      </div>
    </div>
  );
}
