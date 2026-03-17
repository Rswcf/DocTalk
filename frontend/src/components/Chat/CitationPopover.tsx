"use client";

import React, { useState, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Citation } from '../../types';

interface CitationPopoverProps {
  citation: Citation;
  children: React.ReactNode;
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function CitationPopover({ citation, children }: CitationPopoverProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 300);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  const hasExtra = citation.confidenceScore != null || citation.contextText || citation.documentId;
  if (!hasExtra) return <>{children}</>;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={() => setShow(!show)}
    >
      {children}
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-lg shadow-lg border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs">
          {citation.confidenceScore != null && (
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${confidenceColor(citation.confidenceScore)}`} />
              <span className="text-zinc-500 dark:text-zinc-400">
                {Math.round(citation.confidenceScore * 100)}% confidence
              </span>
            </div>
          )}
          <div className="text-zinc-500 dark:text-zinc-400 mb-1">
            {citation.documentFilename && (
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{citation.documentFilename}</span>
            )}
            {citation.page && <span> &mdash; p. {citation.page}</span>}
          </div>
          {citation.contextText && (
            <p className="text-zinc-600 dark:text-zinc-400 line-clamp-4 mt-1">
              &ldquo;{citation.contextText}&rdquo;
            </p>
          )}
          {citation.documentId && (
            <a
              href={`/d/${citation.documentId}?page=${citation.page}&highlight=${citation.chunkId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} /> View in original
            </a>
          )}
        </div>
      )}
    </span>
  );
}
