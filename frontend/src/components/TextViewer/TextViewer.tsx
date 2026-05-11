"use client";

import React, { Suspense, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import remarkGfm from 'remark-gfm';
import { Search, ChevronLeft, ChevronRight, X, ExternalLink, Globe2, ListTree } from 'lucide-react';
import { PROXY_BASE } from '../../lib/api';
import { useLocale } from '../../i18n';
import { Spinner } from '../spell';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface TextPage {
  page_number: number;
  text: string;
  section_title?: string | null;
}

interface SourceMeta {
  title?: string | null;
  sourceUrl?: string | null;
  domain?: string | null;
  isUrlSource: boolean;
}

interface Props {
  documentId: string;
  fileType?: string;
  targetPage?: number;
  scrollNonce?: number;
  highlightSnippet?: string | null;
}

/** Whether to use markdown rendering for this file type */
function shouldRenderMarkdown(fileType?: string): boolean {
  return fileType === 'md' || fileType === 'docx' || fileType === 'pptx' || fileType === 'xlsx';
}

function displayDomain(sourceUrl?: string | null, fallback?: string | null): string {
  if (fallback) return fallback.replace(/^www\./, '');
  if (!sourceUrl) return '';
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return sourceUrl.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

function estimateReadableUnits(text: string): number {
  const latinWords = text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g)?.length ?? 0;
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return latinWords + Math.ceil(cjkChars / 2);
}

function stripLeadingMatchingHeading(text: string, title?: string | null): string {
  const lines = text.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1) return text;

  const first = lines[firstContentIndex].trim();
  const match = first.match(/^#{1,6}\s+(.+)$/);
  if (!match) return text;

  const heading = match[1].trim();
  if (title && heading !== title.trim()) return text;

  return [
    ...lines.slice(0, firstContentIndex),
    ...lines.slice(firstContentIndex + 1),
  ].join('\n').trimStart();
}

function leadingMarkdownHeading(text: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^#{1,6}\s+(.+)$/);
    return match ? match[1].trim() : null;
  }
  return null;
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

const scrollBehavior = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' as const : 'smooth' as const;

export default function TextViewer({ documentId, fileType, targetPage, scrollNonce, highlightSnippet }: Props) {
  const [pages, setPages] = useState<TextPage[]>([]);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta>({
    isUrlSource: fileType === 'url',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const highlightRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>;
  const { t } = useLocale();
  const isUrlSource = sourceMeta.isUrlSource || fileType === 'url';
  const isMarkdown = isUrlSource || shouldRenderMarkdown(fileType);

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
          activeMark.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
        } else {
          el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
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
          setSourceMeta({
            title: data.title,
            sourceUrl: data.source_url,
            domain: data.domain,
            isUrlSource: Boolean(data.source_url) || data.file_type === 'url' || fileType === 'url',
          });
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
  }, [documentId, fileType]);

  // Scroll to target page (and highlight) when citation is clicked
  useEffect(() => {
    if (targetPage && scrollNonce) {
      // Use requestAnimationFrame to wait for highlight render
      requestAnimationFrame(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
        } else {
          const el = pageRefs.current.get(targetPage);
          if (el) {
            el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
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
        <Spinner variant="bars" size="lg" label="Loading document" />
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
    <div ref={containerRef} className="h-full flex flex-col" tabIndex={-1}>
      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 text-sm shrink-0 px-3 py-1.5 bg-white/90 dark:bg-zinc-800/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-700">
          <Search aria-hidden="true" size={14} className="text-zinc-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('toolbar.searchPlaceholder')}
            className="flex-1 min-w-0 border-none bg-transparent text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-100 placeholder:text-zinc-400"
            aria-label={t('toolbar.search')}
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
            <span className="tabular-nums whitespace-nowrap text-xs text-zinc-400">
              {searchMatches.length > 0 ? t('toolbar.matchCount', { current: currentMatchIndex + 1, total: searchMatches.length }) : t('toolbar.noMatches')}
            </span>
          )}
          <button onClick={searchPrev} disabled={searchMatches.length === 0} className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400" title={t('toolbar.prevPage')} aria-label={t('toolbar.prevPage')}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={searchNext} disabled={searchMatches.length === 0} className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400" title={t('toolbar.nextPage')} aria-label={t('toolbar.nextPage')}>
            <ChevronRight size={14} />
          </button>
          <button onClick={searchClose} className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400" aria-label={t('toolbar.closeSearch')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page content */}
      {isUrlSource ? (
        <WebArticleView
          pages={pages}
          sourceMeta={sourceMeta}
          pageRefs={pageRefs}
          highlightMatch={highlightMatch}
          highlightRef={highlightRef}
          onOpenSearch={() => {
            setSearchOpen(true);
            requestAnimationFrame(() => searchInputRef.current?.focus());
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
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
                <div className="flex items-center justify-between text-xs mb-2 sticky top-0 py-1 z-[1] text-zinc-400 bg-white dark:bg-zinc-950">
                  <span>{t('doc.page')} {page.page_number}</span>
                  {!searchOpen && (
                    <button
                      onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchInputRef.current?.focus()); }}
                      className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400"
                      title={t('toolbar.search')}
                      aria-label={t('toolbar.search')}
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
      )}
    </div>
  );
}

function WebArticleView({
  pages,
  sourceMeta,
  pageRefs,
  highlightMatch,
  highlightRef,
  onOpenSearch,
}: {
  pages: TextPage[];
  sourceMeta: SourceMeta;
  pageRefs: React.MutableRefObject<Map<number, HTMLElement>>;
  highlightMatch: { pageNumber: number; start: number; length: number } | null;
  highlightRef: React.RefObject<HTMLSpanElement>;
  onOpenSearch: () => void;
}) {
  const { t, tOr } = useLocale();
  const domain = displayDomain(sourceMeta.sourceUrl, sourceMeta.domain);
  const title = sourceMeta.title || domain || tOr('viewer.webSource', 'Web source');
  const fullText = useMemo(() => pages.map((page) => page.text).join('\n\n'), [pages]);
  const stats = useMemo(() => {
    const readableUnits = estimateReadableUnits(fullText);
    return {
      sections: pages.length,
      readMinutes: Math.max(1, Math.ceil(readableUnits / 260)),
    };
  }, [fullText, pages.length]);
  const sections = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .map((page) => ({
        pageNumber: page.page_number,
        title: page.section_title?.trim() || leadingMarkdownHeading(page.text) || '',
      }))
      .filter((section) => {
        if (!section.title || seen.has(section.title)) return false;
        seen.add(section.title);
        return true;
      })
      .slice(0, 12);
  }, [pages]);

  const jumpToPage = useCallback((pageNumber: number) => {
    const el = pageRefs.current.get(pageNumber);
    if (el) el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, [pageRefs]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-stone-50/60 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Globe2 aria-hidden="true" size={14} className="shrink-0" />
              <span className="truncate">{domain || tOr('viewer.importedUrl', 'Imported URL')}</span>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="whitespace-nowrap">
                {tOr('viewer.articleStats', '{{sections}} sections / {{minutes}} min read')
                  .replace('{{sections}}', String(stats.sections))
                  .replace('{{minutes}}', String(stats.readMinutes))}
              </span>
            </div>
            <h1 className="truncate text-base font-semibold leading-6 text-zinc-950 dark:text-zinc-50">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Search aria-hidden="true" size={15} />
              <span>{t('toolbar.search')}</span>
            </button>
            {sourceMeta.sourceUrl && (
              <a
                href={sourceMeta.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <ExternalLink aria-hidden="true" size={15} />
                <span>{tOr('viewer.openOriginal', 'Open original')}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-5 py-6 lg:px-8">
        {sections.length > 1 && (
          <aside className="hidden w-56 shrink-0 xl:block">
            <div className="sticky top-24">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                <ListTree aria-hidden="true" size={14} />
                <span>{tOr('viewer.sourceOutline', 'Source outline')}</span>
              </div>
              <nav className="space-y-1" aria-label={tOr('viewer.sourceOutline', 'Source outline')}>
                {sections.map((section) => (
                  <button
                    key={`${section.pageNumber}-${section.title}`}
                    type="button"
                    onClick={() => jumpToPage(section.pageNumber)}
                    className="block min-h-10 w-full rounded-md px-2 py-2 text-left text-xs leading-5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  >
                    <span className="line-clamp-2">{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}

        <article className="min-w-0 flex-1">
          <div className="mx-auto max-w-[780px]">
            {pages.map((page) => {
              const citationMatch = highlightMatch?.pageNumber === page.page_number ? highlightMatch : null;
              const pageTitle = page.section_title?.trim() || leadingMarkdownHeading(page.text);
              const body = stripLeadingMatchingHeading(page.text, pageTitle);
              const bodyStart = page.text.indexOf(body);
              const adjustedCitationMatch = citationMatch && bodyStart >= 0
                ? {
                    ...citationMatch,
                    start: citationMatch.start - bodyStart,
                  }
                : citationMatch;
              const bodyCitationMatch = adjustedCitationMatch
                && adjustedCitationMatch.start >= 0
                && adjustedCitationMatch.start < body.length
                ? adjustedCitationMatch
                : null;

              return (
                <section
                  key={page.page_number}
                  ref={(el) => { if (el) pageRefs.current.set(page.page_number, el); }}
                  className="scroll-mt-28 border-b border-zinc-200/80 pb-8 pt-1 first:pt-0 last:border-b-0 dark:border-zinc-800"
                >
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    <span>{tOr('viewer.section', 'Section')} {page.page_number}</span>
                    {pageTitle && (
                      <>
                        <span aria-hidden="true">/</span>
                        <span className="truncate">{pageTitle}</span>
                      </>
                    )}
                  </div>
                  {pageTitle && (
                    <h2 className="mb-4 text-2xl font-semibold leading-tight text-zinc-950 dark:text-zinc-50">
                      {pageTitle}
                    </h2>
                  )}
                  <MarkdownContent
                    text={body}
                    citationMatch={bodyCitationMatch}
                    highlightRef={highlightRef}
                    articleMode
                  />
                </section>
              );
            })}
          </div>
        </article>
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
              className="bg-amber-200 dark:bg-amber-700/60 rounded-sm transition-colors duration-500"
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'search-active') {
          return (
            <mark key={i} className="search-match-active bg-amber-400 dark:bg-amber-500 dark:text-white text-zinc-900 rounded-sm">
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
  articleMode = false,
}: {
  text: string;
  citationMatch: { start: number; length: number } | null;
  highlightRef: React.RefObject<HTMLSpanElement>;
  articleMode?: boolean;
}) {
  const markdownFallback = (
    <div className="flex items-center justify-center py-8">
      <Spinner variant="circle" size="md" label="Rendering content" />
    </div>
  );

  return (
    <div className={`prose dark:prose-invert max-w-none prose-zinc ${articleMode ? 'prose-base prose-p:leading-8 prose-li:leading-8 prose-headings:scroll-mt-28' : 'prose-sm'}
      prose-table:border-collapse prose-table:w-full prose-table:text-sm
      prose-th:border prose-th:border-zinc-300 prose-th:dark:border-zinc-600 prose-th:px-3 prose-th:py-2 prose-th:bg-zinc-50 prose-th:dark:bg-zinc-800 prose-th:text-left prose-th:font-semibold
      prose-td:border prose-td:border-zinc-200 prose-td:dark:border-zinc-700 prose-td:px-3 prose-td:py-1.5
      prose-tr:even:bg-zinc-50/50 prose-tr:even:dark:bg-zinc-800/30
      prose-pre:bg-zinc-100 prose-pre:dark:bg-zinc-800 prose-pre:rounded-lg
      prose-code:text-zinc-700 prose-code:dark:text-zinc-300
      prose-a:text-zinc-600 prose-a:dark:text-zinc-400 prose-a:underline
      prose-headings:text-zinc-900 prose-headings:dark:text-zinc-100
      prose-strong:text-zinc-900 prose-strong:dark:text-zinc-100
    `}>
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
          <Suspense fallback={markdownFallback}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </Suspense>
        </>
      ) : (
        <Suspense fallback={markdownFallback}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </Suspense>
      )}
    </div>
  );
}
