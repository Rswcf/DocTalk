"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { PROXY_BASE } from '../../lib/api';
import { useLocale } from '../../i18n';

interface TextPage {
  page_number: number;
  text: string;
}

interface Props {
  documentId: string;
  fileType?: string;
  targetPage?: number;
  scrollNonce?: number;
  highlightSnippet?: string | null;
}

/** Whether to use markdown rendering for this file type */
function useMarkdownRendering(fileType?: string): boolean {
  return fileType === 'md' || fileType === 'docx' || fileType === 'pptx' || fileType === 'xlsx';
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

/** Find all case-insensitive matches of a query in text */
function findAllMatches(text: string, query: string): number[] {
  if (!query || query.length < 2) return [];
  const indices: number[] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let pos = 0;
  while (pos < lower.length) {
    const idx = lower.indexOf(q, pos);
    if (idx === -1) break;
    indices.push(idx);
    pos = idx + 1;
  }
  return indices;
}

export default function TextViewer({ documentId, fileType, targetPage, scrollNonce, highlightSnippet }: Props) {
  const [pages, setPages] = useState<TextPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const highlightRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>;
  const { t } = useLocale();
  const { resolvedTheme } = useTheme();
  const isWin98 = resolvedTheme === 'win98';
  const isMarkdown = useMarkdownRendering(fileType);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute all search matches across pages
  const searchMatches = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const matches: { page: number; index: number }[] = [];
    for (const page of pages) {
      const indices = findAllMatches(page.text, searchQuery);
      for (const idx of indices) {
        matches.push({ page: page.page_number, index: idx });
      }
    }
    return matches;
  }, [searchQuery, pages]);

  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Reset match index when matches change
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchMatches.length]);

  const navigateToMatch = useCallback((matchIdx: number) => {
    if (matchIdx < 0 || matchIdx >= searchMatches.length) return;
    setCurrentMatchIndex(matchIdx);
    const match = searchMatches[matchIdx];
    const el = pageRefs.current.get(match.page);
    if (el) {
      // Find the active match mark within this page
      requestAnimationFrame(() => {
        const activeMark = el.querySelector('.search-match-active');
        if (activeMark) {
          activeMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, [searchMatches]);

  const searchNext = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = (currentMatchIndex + 1) % searchMatches.length;
    navigateToMatch(next);
  }, [currentMatchIndex, searchMatches.length, navigateToMatch]);

  const searchPrev = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    navigateToMatch(prev);
  }, [currentMatchIndex, searchMatches.length, navigateToMatch]);

  const searchClose = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

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

  // Keyboard shortcut: Ctrl+F to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('keydown', handler);
      return () => el.removeEventListener('keydown', handler);
    }
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        <div className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-2 border-zinc-300 border-t-zinc-600" role="status" />
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
    <div ref={containerRef} className={`h-full flex flex-col ${isWin98 ? 'bg-[var(--win98-button-face)]' : ''}`} tabIndex={-1}>
      {/* Search bar */}
      {searchOpen && (
        <div className={`flex items-center gap-2 text-sm shrink-0 ${
          isWin98
            ? 'bg-[var(--win98-button-face)] px-2 py-[2px] border-b border-b-[var(--win98-button-shadow)] text-[11px]'
            : 'px-3 py-1.5 bg-white/90 dark:bg-zinc-800/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-700'
        }`}>
          <Search aria-hidden="true" size={14} className={isWin98 ? 'text-[var(--win98-black)] shrink-0' : 'text-zinc-400 shrink-0'} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('toolbar.searchPlaceholder')}
            className={isWin98
              ? 'win98-input flex-1 min-w-0 text-[11px] h-[18px]'
              : 'flex-1 min-w-0 border-none bg-transparent text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-100 placeholder:text-zinc-400'
            }
            aria-label="Search in document"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? searchPrev() : searchNext();
              }
              if (e.key === 'Escape') {
                searchClose();
              }
            }}
          />
          {searchQuery && (
            <span className={`tabular-nums whitespace-nowrap ${isWin98 ? 'text-[10px] text-[var(--win98-dark-gray)]' : 'text-xs text-zinc-400'}`}>
              {searchMatches.length > 0 ? t('toolbar.matchCount', { current: currentMatchIndex + 1, total: searchMatches.length }) : t('toolbar.noMatches')}
            </span>
          )}
          <button onClick={searchPrev} disabled={searchMatches.length === 0} className={isWin98 ? 'win98-button flex items-center justify-center w-[20px] h-[20px] p-0 disabled:opacity-30' : 'p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400'} title={t('toolbar.prevPage')} aria-label="Previous match">
            <ChevronLeft size={isWin98 ? 10 : 14} />
          </button>
          <button onClick={searchNext} disabled={searchMatches.length === 0} className={isWin98 ? 'win98-button flex items-center justify-center w-[20px] h-[20px] p-0 disabled:opacity-30' : 'p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400'} title={t('toolbar.nextPage')} aria-label="Next match">
            <ChevronRight size={isWin98 ? 10 : 14} />
          </button>
          <button onClick={searchClose} className={isWin98 ? 'win98-button flex items-center justify-center w-[20px] h-[20px] p-0' : 'p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400'} aria-label="Close search">
            <X size={isWin98 ? 10 : 14} />
          </button>
        </div>
      )}

      {/* Page content */}
      <div className={`flex-1 overflow-y-auto p-6 ${isWin98 ? 'win98-scrollbar win98-inset m-1 bg-white' : ''}`}>
        {pages.map((page) => {
          const citationMatch = highlightMatch?.pageNumber === page.page_number ? highlightMatch : null;
          // Search matches for this page
          const pageSearchMatches = searchQuery && searchQuery.length >= 2
            ? findAllMatches(page.text, searchQuery)
            : [];

          return (
            <div
              key={page.page_number}
              ref={(el) => { if (el) pageRefs.current.set(page.page_number, el); }}
              className="mb-8"
            >
              <div className={`flex items-center justify-between text-xs mb-2 sticky top-0 py-1 z-[1] ${isWin98 ? 'text-[var(--win98-dark-gray)] bg-white text-[10px]' : 'text-zinc-400 bg-white dark:bg-zinc-950'}`}>
                <span>{t('doc.page')} {page.page_number}</span>
                {!searchOpen && (
                  <button
                    onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchInputRef.current?.focus()); }}
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400"
                    title={t('toolbar.search')}
                    aria-label="Search in document"
                  >
                    <Search aria-hidden="true" size={12} />
                  </button>
                )}
              </div>

              {isMarkdown ? (
                <MarkdownContent
                  text={page.text}
                  citationMatch={citationMatch}
                  highlightRef={highlightRef}
                />
              ) : (
                <PlainTextContent
                  text={page.text}
                  citationMatch={citationMatch}
                  highlightRef={highlightRef}
                  searchQuery={searchQuery}
                  searchMatches={pageSearchMatches}
                  currentActiveMatch={
                    searchMatches.length > 0 && searchMatches[currentMatchIndex]?.page === page.page_number
                      ? searchMatches[currentMatchIndex].index
                      : null
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Plain text renderer with search and citation highlights */
function PlainTextContent({
  text,
  citationMatch,
  highlightRef,
  searchQuery,
  searchMatches,
  currentActiveMatch,
}: {
  text: string;
  citationMatch: { start: number; length: number } | null;
  highlightRef: React.RefObject<HTMLSpanElement>;
  searchQuery: string;
  searchMatches: number[];
  currentActiveMatch: number | null;
}) {
  // Build highlighted segments
  const segments = useMemo(() => {
    type Segment = { text: string; type: 'normal' | 'citation' | 'search' | 'search-active' };
    const result: Segment[] = [];

    // Collect all highlight ranges
    const ranges: { start: number; end: number; type: 'citation' | 'search' | 'search-active' }[] = [];

    // Citation highlight
    if (citationMatch) {
      ranges.push({
        start: citationMatch.start,
        end: citationMatch.start + citationMatch.length,
        type: 'citation',
      });
    }

    // Search highlights
    if (searchQuery && searchQuery.length >= 2) {
      for (const idx of searchMatches) {
        ranges.push({
          start: idx,
          end: idx + searchQuery.length,
          type: idx === currentActiveMatch ? 'search-active' : 'search',
        });
      }
    }

    if (ranges.length === 0) {
      result.push({ text, type: 'normal' });
      return result;
    }

    // Sort by start position, citation takes priority
    ranges.sort((a, b) => a.start - b.start || (a.type === 'citation' ? -1 : 1));

    // Remove overlapping ranges (keep first)
    const merged: typeof ranges = [];
    for (const r of ranges) {
      if (merged.length === 0 || r.start >= merged[merged.length - 1].end) {
        merged.push(r);
      }
    }

    // Build segments
    let pos = 0;
    for (const r of merged) {
      if (r.start > pos) {
        result.push({ text: text.slice(pos, r.start), type: 'normal' });
      }
      result.push({ text: text.slice(r.start, r.end), type: r.type });
      pos = r.end;
    }
    if (pos < text.length) {
      result.push({ text: text.slice(pos), type: 'normal' });
    }

    return result;
  }, [text, citationMatch, searchQuery, searchMatches, currentActiveMatch]);

  return (
    <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'citation') {
          return (
            <span
              key={i}
              ref={highlightRef}
              className="bg-amber-200 dark:bg-amber-700/60 rounded-sm transition-colors duration-[3000ms]"
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'search-active') {
          return (
            <mark key={i} className="search-match-active bg-amber-400 dark:bg-amber-500 text-zinc-900 rounded-sm">
              {seg.text}
            </mark>
          );
        }
        if (seg.type === 'search') {
          return (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 rounded-sm">
              {seg.text}
            </mark>
          );
        }
        return <React.Fragment key={i}>{seg.text}</React.Fragment>;
      })}
    </pre>
  );
}

/** Markdown renderer with citation highlight support */
function MarkdownContent({
  text,
  citationMatch,
  highlightRef,
}: {
  text: string;
  citationMatch: { start: number; length: number } | null;
  highlightRef: React.RefObject<HTMLSpanElement>;
}) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-zinc
      prose-table:border-collapse prose-table:w-full prose-table:text-sm
      prose-th:border prose-th:border-zinc-300 prose-th:dark:border-zinc-600 prose-th:px-3 prose-th:py-2 prose-th:bg-zinc-50 prose-th:dark:bg-zinc-800 prose-th:text-left prose-th:font-semibold
      prose-td:border prose-td:border-zinc-200 prose-td:dark:border-zinc-700 prose-td:px-3 prose-td:py-1.5
      prose-tr:even:bg-zinc-50/50 prose-tr:even:dark:bg-zinc-800/30
      prose-pre:bg-zinc-100 prose-pre:dark:bg-zinc-800 prose-pre:rounded-lg
      prose-code:text-zinc-700 prose-code:dark:text-zinc-300
      prose-a:text-zinc-600 prose-a:dark:text-zinc-400 prose-a:underline
      prose-headings:text-zinc-900 prose-headings:dark:text-zinc-100
      prose-strong:text-zinc-900 prose-strong:dark:text-zinc-100
    ">
      {citationMatch ? (
        <>
          {/* For markdown, show the citation highlight inline before the rendered content */}
          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 border-l-3 border-amber-400 rounded-r text-sm">
            <span
              ref={highlightRef}
              className="bg-amber-200 dark:bg-amber-700/60 rounded-sm"
            >
              {text.slice(citationMatch.start, citationMatch.start + citationMatch.length)}
            </span>
          </div>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      )}
    </div>
  );
}
