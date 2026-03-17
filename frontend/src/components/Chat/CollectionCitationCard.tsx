"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { Citation } from '../../types';

interface Props {
  citation: Citation;
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function CollectionCitationCard({ citation }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <span className="inline">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded"
      >
        [{citation.refIndex}]
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {expanded && (
        <div className="block mt-1 mb-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs">
          <div className="flex items-center gap-2 mb-1">
            {citation.confidenceScore != null && (
              <div className={`w-2 h-2 rounded-full ${confidenceColor(citation.confidenceScore)}`} />
            )}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {citation.documentFilename || 'Document'}
            </span>
            <span className="text-zinc-500">p. {citation.page}</span>
          </div>
          {citation.contextText && (
            <p className="text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-4">
              &ldquo;{citation.contextText}&rdquo;
            </p>
          )}
          {citation.documentId && (
            <a
              href={`/d/${citation.documentId}?page=${citation.page}&highlight=${citation.chunkId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <ExternalLink size={10} /> View in original
            </a>
          )}
        </div>
      )}
    </span>
  );
}
