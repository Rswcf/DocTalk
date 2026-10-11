"use client";

import React, { Suspense, createContext, useContext, useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react';
import remarkGfm from 'remark-gfm';
import type { Options as MarkdownOptions } from 'react-markdown';
import { Search, ChevronLeft, ChevronRight, X, ExternalLink, Globe2, ListTree, Eye, EyeOff } from 'lucide-react';
import { PROXY_BASE, getChunkDetail } from '../../lib/api';
import { findSnippetInPage } from '../../lib/snippetMatch';
import { useLocale } from '../../i18n';
import { Spinner } from '../spell';
import { citationChunkText, citationPageRange, dropTrailingFragment } from '../../lib/citationText';
import { locateTextEvidence, type TextEvidence } from '../../lib/textEvidence';
import { articleEvidence, articlePage, bodyRanges, leadingMarkdownHeading } from '../../lib/articleEvidence';
import { NO_RENDERED_MARKS, shownEvidenceStatus, type EvidenceStatus, type RenderedMarks } from '../../lib/evidenceStatus';
import { rehypeMarkRanges, type MarkRange } from '../../lib/rehypeMarkRanges';
import { anchorScrolls, armJump, bodiesReady as allBodiesMounted, jumpApplies, jumpTarget, type JumpToken } from '../../lib/textJump';
import { plainEvidenceSegments, type PlainPart } from '../../lib/plainEvidence';
import type { Citation } from '../../types';

const ReactMarkdown = React.lazy(() => import('react-markdown'));

type PluggableList = NonNullable<MarkdownOptions['rehypePlugins']>;

// Stable references: MarkdownContent is memoized, and react-markdown re-parses
// on every render, so only the cited page may receive new plugin options.
const REMARK_PLUGINS: PluggableList = [remarkGfm];
const NO_REHYPE_PLUGINS: PluggableList = [];
const NO_MARKS: MarkRange[] = [];
const NO_MARKS_BY_PAGE = new Map<number, MarkRange[]>();

interface EvidenceState { citation: Citation; status: EvidenceStatus; byPage: Map<number, MarkRange[]> }

// The anchor mark scrolls the cited passage into view once it mounts: marks
// render inside <Suspense> and may wait for the full chunk text.
const EvidenceAnchorContext = createContext<((element: HTMLElement | null) => void) | null>(null);

// Every mounted mark and Markdown body reports itself (and un-reports on
// unmount), so the status line names what rendered, not what was located.
// Layout effects: the label is corrected before the frame is painted.
type ReportRendered = (key: keyof RenderedMarks) => () => void;
const RenderedMarksContext = createContext<ReportRendered | null>(null);

function EvidenceMark(props: React.ComponentPropsWithoutRef<'mark'> & { node?: unknown }) {
  const { node, ...rest } = props;
  void node;
  const onAnchor = useContext(EvidenceAnchorContext);
  const report = useContext(RenderedMarksContext);
  const attributes = rest as Record<string, unknown>;
  const isAnchor = attributes['data-dt-evidence-anchor'] === 'true';
  const kind = attributes['data-dt-evidence'] === 'exact' ? 'exact' : 'region';
  useLayoutEffect(() => report?.(kind), [report, kind]);
  return <mark {...rest} ref={isAnchor && onAnchor ? onAnchor : undefined} />;
}

/** Mounts with the page body it follows: for Markdown, once react-markdown
 * has loaded; a plain-text body mounts at once. */
function PageBodyMounted() {
  const report = useContext(RenderedMarksContext);
  useLayoutEffect(() => report?.('bodies'), [report]);
  return null;
}

const MARKDOWN_COMPONENTS = { mark: EvidenceMark };

// Chat context_text stops at 900 characters; tables and long chunks need the
// whole chunk. Quote Finder and saved quotes have no context text at all.
const chunkTextCache = new Map<string, Promise<string | null>>();
function fetchChunkText(chunkId: string): Promise<string | null> {
  let pending = chunkTextCache.get(chunkId);
  if (!pending) {
    pending = getChunkDetail(chunkId).then(
      (chunk) => chunk.text || null,
      () => { chunkTextCache.delete(chunkId); return null; },
    );
    chunkTextCache.set(chunkId, pending);
  }
  return pending;
}

function marksByPage(evidence: TextEvidence): Map<number, MarkRange[]> {
  const byPage = new Map<number, MarkRange[]>();
  for (const range of evidence.ranges) {
    const marks = byPage.get(range.page) || [];
    marks.push({
      start: range.start,
      end: range.end,
      kind: range.emphasis ? 'exact' : 'region',
      anchor: evidence.anchor?.page === range.page && evidence.anchor.start === range.start,
    });
    byPage.set(range.page, marks);
  }
  return byPage;
}

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
  /** Verbatim supporting sentence (chat focus or Quote Finder quote). */
  highlightFocus?: string | null;
  /** The active citation; its chunk text drives the Markdown highlight. */
  citation?: Citation | null;
  onReturnToAnswer?: () => void;
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

export default function TextViewer({ documentId, fileType, targetPage, scrollNonce, highlightSnippet, highlightFocus, citation, onReturnToAnswer }: Props) {
  const [pages, setPages] = useState<TextPage[]>([]);
  // The document whose pages `pages` holds: after a switch the previous
  // document's pages stay until the new ones arrive.
  const [pagesFor, setPagesFor] = useState<string | null>(null);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta>({
    isUrlSource: fileType === 'url',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const highlightRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>;
  // Whether this document's opening page (e.g. `?page=N` from a saved quote)
  // has been scrolled to; later jumps are driven by scrollNonce.
  const initialPageApplied = useRef(false);
  const { t } = useLocale();
  const isUrlSource = sourceMeta.isUrlSource || fileType === 'url';
  const isMarkdown = isUrlSource || shouldRenderMarkdown(fileType);
  // TXT pages take the same evidence path, rendered as plain text. A
  // missing-file PDF (also plain) keeps the backend snippet match.
  const isPlainEvidence = !isMarkdown && fileType === 'txt';
  const usesEvidence = isMarkdown || isPlainEvidence;
  const [evidence, setEvidence] = useState<EvidenceState | null>(null);
  const [hiddenEvidence, setHiddenEvidence] = useState(false);
  const renderedCounts = useRef<RenderedMarks>({ ...NO_RENDERED_MARKS });
  const [renderedMarks, setRenderedMarks] = useState<RenderedMarks>(NO_RENDERED_MARKS);
  const reportRendered = useCallback<ReportRendered>((key) => {
    const counts = renderedCounts.current;
    const publish = () => setRenderedMarks((previous) => (
      previous.exact === counts.exact && previous.region === counts.region && previous.bodies === counts.bodies
        ? previous : { ...counts }));
    counts[key] += 1;
    publish();
    return () => { counts[key] -= 1; publish(); };
  }, []);
  // The citation whose anchor should scroll into view when it mounts; cleared
  // once it has, or when the reader scrolls first.
  const pendingAnchor = useRef<Citation | null>(null);
  // The jump waiting for every page body to mount (lib/textJump.ts), and the
  // anchor mark that mounted last, with the citation it belongs to.
  const pendingJump = useRef<JumpToken<Citation> | null>(null);
  const mountedAnchor = useRef<{ citation: Citation; element: HTMLElement } | null>(null);
  const evidenceCitation = usesEvidence ? citation ?? null : null;

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
    initialPageApplied.current = false;
    setLoading(true);
    fetch(`${PROXY_BASE}/api/documents/${documentId}/text-content`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setPages(data.pages || []);
          setPagesFor(documentId);
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

  // Scroll to target page (and highlight) when citation is clicked. `pages`
  // is a dependency so a target set before the text arrived (a citation deep
  // link, or a click during the fetch) is applied once it renders; the nonce
  // is reset on every document switch, so no earlier target is replayed. A
  // page-only link (`?page=N`, no nonce) is honoured once per document.
  // The jump is armed here and runs below once every page body has mounted.
  // It carries its document, click and citation, and scrolls only while the
  // current state would arm the same jump (Codex r4 #2): a document switch or
  // a new citation while the bodies are mounting drops it. A state that arms
  // nothing (no pages of this document yet, no target) clears every pending
  // scroll.
  const bodiesReady = pagesFor === documentId && allBodiesMounted(pages.length, renderedMarks.bodies, isMarkdown);
  const armed = armJump({
    documentId, pagesFor, pages: pages.length, targetPage, nonce: scrollNonce,
    openingApplied: initialPageApplied.current, citation: citation ?? null, evidence: usesEvidence,
  });
  const armedRef = useRef(armed);
  armedRef.current = armed;
  useEffect(() => {
    const jump = armedRef.current;
    pendingJump.current = jump;
    pendingAnchor.current = jump ? jump.citation : null;
    if (!jump) mountedAnchor.current = null;
  }, [documentId, pagesFor, targetPage, scrollNonce, pages, usesEvidence]);
  useEffect(() => {
    if (!pendingJump.current || !bodiesReady) return;
    // Use requestAnimationFrame to wait for highlight render
    const frame = requestAnimationFrame(() => {
      const jump = pendingJump.current;
      if (!jump) return;
      pendingJump.current = null;
      if (!jumpApplies(jump, armedRef.current)) {
        pendingAnchor.current = null;
        return;
      }
      initialPageApplied.current = true;
      const mounted = mountedAnchor.current?.element.isConnected ? mountedAnchor.current : null;
      const target = jumpTarget({
        ready: true,
        citation: jump.citation,
        pendingAnchor: pendingAnchor.current,
        mountedAnchorFor: mounted?.citation ?? null,
        caption: Boolean(highlightRef.current),
      });
      if (target === 'anchor') {
        pendingAnchor.current = null;
        mounted!.element.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      } else if (target === 'caption') {
        highlightRef.current!.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      } else if (target === 'page') {
        // Page start is the immediate fallback; a late anchor still scrolls.
        pageRefs.current.get(jump.page)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [documentId, pagesFor, targetPage, scrollNonce, pages, usesEvidence, bodiesReady]);

  // Locate the cited chunk in the Markdown page text. Chat citations carry
  // the chunk (cut at 900 characters) in context_text; anything shorter than
  // the whole chunk is completed from /api/chunks/{id}, and a failed fetch
  // falls back to what the citation carries.
  useEffect(() => {
    if (!evidenceCitation || pages.length === 0) { setEvidence(null); return; }
    const target = evidenceCitation;
    const lastPage = Math.max(target.pageEnd || target.page, target.page);
    if (!pages.some((page) => page.page_number >= target.page && page.page_number <= lastPage)) {
      setEvidence({ citation: target, status: 'unavailable', byPage: NO_MARKS_BY_PAGE });
      return;
    }
    const focus = highlightFocus ?? target.focusSnippet ?? null;
    const settle = (chunkText: string | null) => {
      const located = locateTextEvidence(pages, target, chunkText, focus);
      // The article view renders no mark in a page's leading heading; the
      // status must name what it does render.
      const result = isUrlSource ? articleEvidence(pages, located) : located;
      setEvidence({ citation: target, status: result.kind, byPage: marksByPage(result) });
    };
    const known = citationChunkText(target);
    if (known && !known.truncated) { settle(known.text); return; }
    let cancelled = false;
    setEvidence({ citation: target, status: 'loading', byPage: NO_MARKS_BY_PAGE });
    void fetchChunkText(target.chunkId).then((full) => {
      if (cancelled) return;
      settle(full ?? (known ? dropTrailingFragment(known.text) : target.textSnippet || null));
    });
    return () => { cancelled = true; };
  }, [evidenceCitation, highlightFocus, pages, isUrlSource]);

  useEffect(() => { setHiddenEvidence(false); }, [citation]);

  const currentEvidence = evidence && evidence.citation === evidenceCitation ? evidence : null;
  const locatedStatus: EvidenceStatus = currentEvidence?.status ?? 'loading';
  const evidenceByPage = currentEvidence?.byPage ?? NO_MARKS_BY_PAGE;
  // A located range may render no mark (raw HTML, a cut reference, an
  // ambiguous alignment): the status follows the marks that rendered.
  const evidenceStatus = shownEvidenceStatus(locatedStatus, renderedMarks);
  const captionPage = evidenceCitation && evidenceStatus === 'page' ? evidenceCitation.page : null;

  // A new evidence state (or the bodies becoming ready) gets a new callback,
  // so React re-attaches it to the anchor mark even when the element itself
  // is reused. An anchor that mounts before every body has is only recorded;
  // the pending jump scrolls to it once they have.
  const onAnchor = useCallback((element: HTMLElement | null) => {
    if (!element || !currentEvidence) return;
    mountedAnchor.current = { citation: currentEvidence.citation, element };
    if (!anchorScrolls({ ready: bodiesReady, citation: currentEvidence.citation, pendingAnchor: pendingAnchor.current })) return;
    pendingAnchor.current = null;
    element.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [currentEvidence, bodiesReady]);
  const cancelPendingAnchor = useCallback(() => { pendingAnchor.current = null; pendingJump.current = null; }, []);

  // Compute which page has a highlight match
  // A missing-file PDF keeps matching the backend snippet; every evidence
  // format (Markdown, URL, TXT) never uses it.
  const highlightMatch = useMemo(() => {
    if (usesEvidence || !highlightSnippet || !targetPage) return null;
    const page = pages.find(p => p.page_number === targetPage);
    if (!page) return null;
    const match = findSnippetInPage(page.text, highlightSnippet);
    if (!match) return null;
    return { pageNumber: targetPage, start: match[0], length: match[1] };
  }, [highlightSnippet, targetPage, pages, scrollNonce, usesEvidence]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const hasMarks = renderedMarks.exact + renderedMarks.region > 0;

  return (
    <EvidenceAnchorContext.Provider value={onAnchor}>
    <RenderedMarksContext.Provider value={reportRendered}>
    <div
      ref={containerRef}
      className="h-full flex flex-col"
      tabIndex={-1}
      data-evidence-hidden={hiddenEvidence ? 'true' : undefined}
      onWheelCapture={cancelPendingAnchor}
      onPointerDownCapture={cancelPendingAnchor}
      onKeyDownCapture={cancelPendingAnchor}
    >
      {evidenceCitation && (
        <div className="dt-evidence-bar flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-xs">
          <span role="status" className="dt-evidence-status min-w-0" tabIndex={-1}>
            {t('evidence.reference', { index: evidenceCitation.refIndex, page: citationPageRange(evidenceCitation) })}
            {' · '}{t(hiddenEvidence && hasMarks ? 'evidence.hidden' : `evidence.${evidenceStatus}`)}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {hasMarks && (
              <button type="button" aria-pressed={hiddenEvidence} onClick={() => setHiddenEvidence((value) => !value)}
                aria-label={t(hiddenEvidence ? 'evidence.show' : 'evidence.hide')} title={t(hiddenEvidence ? 'evidence.show' : 'evidence.hide')}
                className="flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded px-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10">
                {hiddenEvidence ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                <span className="hidden sm:inline">{t(hiddenEvidence ? 'evidence.show' : 'evidence.hide')}</span>
              </button>
            )}
            {onReturnToAnswer && (
              <button type="button" onClick={onReturnToAnswer}
                className="min-h-9 rounded border border-[var(--reader-evidence-border)] px-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10">
                {t('evidence.return')}
              </button>
            )}
          </span>
        </div>
      )}
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
          captionPage={captionPage}
          evidenceByPage={evidenceByPage}
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
                    captionPage={captionPage === page.page_number ? captionPage : null}
                    markRanges={evidenceByPage.get(page.page_number) || NO_MARKS}
                    highlightRef={highlightRef}
                  />
                ) : isPlainEvidence ? (
                  <PlainEvidenceContent
                    text={page.text}
                    captionPage={captionPage === page.page_number ? captionPage : null}
                    markRanges={evidenceByPage.get(page.page_number) || NO_MARKS}
                    highlightRef={highlightRef}
                    searchQuery={searchQuery}
                    searchMatches={pageSearchMatches}
                    currentActiveMatch={
                      searchMatches.length > 0 && searchMatches[currentMatchIndex]?.page === page.page_number
                        ? searchMatches[currentMatchIndex].index
                        : null
                    }
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
    </RenderedMarksContext.Provider>
    </EvidenceAnchorContext.Provider>
  );
}

function WebArticleView({
  pages,
  sourceMeta,
  pageRefs,
  captionPage,
  evidenceByPage,
  highlightRef,
  onOpenSearch,
}: {
  pages: TextPage[];
  sourceMeta: SourceMeta;
  pageRefs: React.MutableRefObject<Map<number, HTMLElement>>;
  captionPage: number | null;
  evidenceByPage: Map<number, MarkRange[]>;
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

  // Each section renders its body without the leading heading, so evidence
  // offsets (into the page text) shift by where the body starts. The evidence
  // was already passed through articleEvidence, so no mark starts in a heading.
  const articlePages = useMemo(() => pages.map((page) => {
    const article = articlePage(page);
    return { page, article, pageTitle: article.title, body: article.body };
  }), [pages]);
  const bodyMarks = useMemo(() => {
    const byPage = new Map<number, MarkRange[]>();
    for (const { page, article } of articlePages) {
      const marks = evidenceByPage.get(page.page_number);
      if (!marks) continue;
      const shifted = bodyRanges(article, marks);
      if (shifted.length) byPage.set(page.page_number, shifted);
    }
    return byPage;
  }, [articlePages, evidenceByPage]);

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
            {articlePages.map(({ page, pageTitle, body }) => {
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
                    captionPage={captionPage === page.page_number ? captionPage : null}
                    markRanges={bodyMarks.get(page.page_number) || NO_MARKS}
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

/** A TXT page with inline citation evidence: the stored text as written
 * (`#`, `*`, `&amp;` and HTML stay characters), evidence ranges as flat
 * `<mark data-dt-evidence>` at their raw offsets, search matches inside or
 * between them (lib/plainEvidence.ts). */
function PlainEvidenceContent({
  text,
  captionPage,
  markRanges,
  highlightRef,
  searchQuery,
  searchMatches,
  currentActiveMatch,
}: {
  text: string;
  /** The cited page when no passage could be located: show a page caption. */
  captionPage: number | null;
  markRanges: MarkRange[];
  highlightRef: React.RefObject<HTMLSpanElement>;
  searchQuery: string;
  searchMatches: number[];
  currentActiveMatch: number | null;
}) {
  const { t } = useLocale();
  const segments = useMemo(() => plainEvidenceSegments(text, markRanges, {
    starts: searchQuery.length >= 2 ? searchMatches : [],
    length: searchQuery.length,
    active: currentActiveMatch,
  }), [text, markRanges, searchQuery.length, searchMatches, currentActiveMatch]);
  const renderParts = (parts: PlainPart[]) => parts.map((part, i) => (
    part.search === 'active' ? (
      <mark key={i} className="search-match-active bg-amber-400 dark:bg-amber-500 dark:text-white text-zinc-900 rounded-sm">{part.text}</mark>
    ) : part.search === 'match' ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 rounded-sm">{part.text}</mark>
    ) : (
      <React.Fragment key={i}>{part.text}</React.Fragment>
    )
  ));

  return (
    <>
      {captionPage != null && (
        <p dir="auto" className="mb-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <span ref={highlightRef}>
            {t('citation.page', { page: captionPage })}
          </span>
        </p>
      )}
      <pre dir="auto" className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
        {segments.map((segment, i) => (segment.mark ? (
          <EvidenceMark key={i} data-dt-evidence={segment.mark.kind} data-dt-evidence-anchor={segment.mark.anchor ? 'true' : undefined}>
            {renderParts(segment.parts)}
          </EvidenceMark>
        ) : (
          <React.Fragment key={i}>{renderParts(segment.parts)}</React.Fragment>
        )))}
      </pre>
      <PageBodyMounted />
    </>
  );
}

/** Plain text renderer with search and citation highlights (missing-file PDFs:
 * the backend snippet's prefix match). */
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
    <pre dir="auto" className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
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

/** Markdown renderer with inline citation evidence. Memoized: the viewer is
 * not virtualized and react-markdown re-parses on every render. */
const MarkdownContent = React.memo(function MarkdownContent({
  text,
  captionPage,
  markRanges,
  highlightRef,
  articleMode = false,
}: {
  text: string;
  /** The cited page when no passage could be located: show a page caption. */
  captionPage: number | null;
  markRanges: MarkRange[];
  highlightRef: React.RefObject<HTMLSpanElement>;
  articleMode?: boolean;
}) {
  const { t } = useLocale();
  const rehypePlugins = useMemo<PluggableList>(
    () => (markRanges.length ? [[rehypeMarkRanges, { ranges: markRanges, source: text }]] : NO_REHYPE_PLUGINS),
    [markRanges, text],
  );
  const markdownFallback = (
    <div className="flex items-center justify-center py-8">
      <Spinner variant="circle" size="md" label={t('common.loading')} />
    </div>
  );

  return (
    <div dir="auto" className={`prose dark:prose-invert max-w-none prose-zinc ${articleMode ? 'prose-base prose-p:leading-8 prose-li:leading-8 prose-headings:scroll-mt-28' : 'prose-sm'}
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
      {/*
        I25 (Wave-2 Batch I, 2026-05-20) replaced a duplicated amber preview
        box with a small caption naming the page. Since 2026-10-11 the cited
        passage is highlighted inline instead: lib/textEvidence.ts locates the
        chunk in this page's Markdown source and lib/rehypeMarkRanges.ts wraps
        the covered text in <mark data-dt-evidence> through hast source
        positions. The caption remains only when no unique passage was found
        (status "page"), and `highlightRef` sits on it for scrolling.
      */}
      {captionPage != null && (
        <p dir="auto" className="not-prose mb-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <span ref={highlightRef}>
            {t('citation.page', { page: captionPage })}
          </span>
        </p>
      )}
      <Suspense fallback={markdownFallback}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={rehypePlugins} components={MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
        <PageBodyMounted />
      </Suspense>
    </div>
  );
});
