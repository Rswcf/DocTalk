"use client";

import React from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
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
  const hasExtra = citation.confidenceScore != null || citation.contextText || citation.documentId;
  if (!hasExtra) return <>{children}</>;

  return (
    <HoverCard.Root openDelay={250} closeDelay={120}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-72 p-3 rounded-lg shadow-lg border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs data-[state=open]:animate-fade-in"
        >
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
              className="inline-flex items-center gap-1 mt-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <ExternalLink size={10} /> View in original
            </a>
          )}
          <HoverCard.Arrow className="fill-white dark:fill-zinc-800" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
