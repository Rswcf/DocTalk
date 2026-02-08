"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { PROXY_BASE } from '../../lib/api';
import { useLocale } from '../../i18n';

interface TextPage {
  page_number: number;
  text: string;
}

interface Props {
  documentId: string;
  targetPage?: number;
  scrollNonce?: number;
  highlightSnippet?: string | null;
}

/**
 * Find the best matching substring of `snippet` within `pageText`.
 * Returns [startIndex, matchLength] or null if no match found.
 *
 * Strategy: try progressively shorter prefixes of the snippet
 * (since backend truncates at 100 chars). Also strips section title
 * prefix ("Title — ...") if present.
 */
function findSnippetInPage(pageText: string, snippet: string): [number, number] | null {
  if (!snippet || !pageText) return null;

  const pageLower = pageText.toLowerCase();

  // Try matching with and without section title prefix
  const candidates = [snippet];
  const dashIdx = snippet.indexOf(' — ');
  if (dashIdx !== -1 && dashIdx < snippet.length - 4) {
    candidates.push(snippet.slice(dashIdx + 3));
  }

  for (const candidate of candidates) {
    const searchText = candidate.toLowerCase().trim();
    if (searchText.length < 10) continue;

    // Try full text first, then progressively shorter prefixes
    for (let len = searchText.length; len >= Math.min(30, searchText.length); len -= 5) {
      const prefix = searchText.slice(0, len);
      const idx = pageLower.indexOf(prefix);
      if (idx !== -1) {
        return [idx, len];
      }
    }
  }

  return null;
}

export default function TextViewer({ documentId, targetPage, scrollNonce, highlightSnippet }: Props) {
  const [pages, setPages] = useState<TextPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const highlightRef = useRef<HTMLSpanElement>(null);
  const { t } = useLocale();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${PROXY_BASE}/api/documents/${documentId}/text-content`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setPages(data.pages || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [documentId]);

  // Scroll to target page (and highlight) when citation is clicked
  useEffect(() => {
    if (targetPage && scrollNonce) {
      // Use requestAnimationFrame to wait for highlight render
      requestAnimationFrame(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const el = pageRefs.current.get(targetPage);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }
  }, [targetPage, scrollNonce]);

  // Compute which page has a highlight match
  const highlightMatch = useMemo(() => {
    if (!highlightSnippet || !targetPage) return null;
    const page = pages.find(p => p.page_number === targetPage);
    if (!page) return null;
    const match = findSnippetInPage(page.text, highlightSnippet);
    if (!match) return null;
    return { pageNumber: targetPage, start: match[0], length: match[1] };
  }, [highlightSnippet, targetPage, pages, scrollNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto p-6">
      {pages.map((page) => {
        const match = highlightMatch?.pageNumber === page.page_number ? highlightMatch : null;
        return (
          <div
            key={page.page_number}
            ref={(el) => { if (el) pageRefs.current.set(page.page_number, el); }}
            className="mb-6"
          >
            <div className="text-xs text-zinc-400 mb-2 sticky top-0 bg-white dark:bg-zinc-950 py-1">
              {t('doc.page')} {page.page_number}
            </div>
            <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
              {match ? (
                <>
                  {page.text.slice(0, match.start)}
                  <span
                    ref={highlightRef}
                    className="bg-amber-200 dark:bg-amber-700/60 rounded-sm transition-colors duration-[3000ms]"
                  >
                    {page.text.slice(match.start, match.start + match.length)}
                  </span>
                  {page.text.slice(match.start + match.length)}
                </>
              ) : (
                page.text
              )}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
