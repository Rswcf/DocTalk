/**
 * When the text view may scroll to a citation (browser acceptance P2-3,
 * 2026-10-11). react-markdown is lazy, and the page bodies can mount in
 * different commits: a body that new marks re-render shows the loaded module
 * at once, while the other pages still wait for React's Suspense retry. A
 * scroll measured then lands short, and once the pages above it get their
 * height the mark (or the `?page=N` page) ends up below the window. So every
 * jump waits until every page body has mounted.
 */

/** Every page body has mounted. `lazyBodies`: the bodies render through the
 * lazy Markdown renderer and report their mount; other renderers are ready at
 * once. */
export function bodiesReady(pages: number, bodies: number, lazyBodies: boolean): boolean {
  return pages > 0 && (!lazyBodies || bodies >= pages);
}

/** What the viewer shows, for arming a jump. */
export interface JumpState<C extends object = object> {
  documentId: string;
  /** The document whose pages the viewer holds; null before any arrived. */
  pagesFor: string | null;
  pages: number;
  targetPage: number | undefined;
  nonce: number | undefined;
  /** This document's opening page (`?page=N`) has been scrolled to. */
  openingApplied: boolean;
  citation: C | null;
  /** The view locates evidence, so a citation jump targets its anchor. */
  evidence: boolean;
}

/** A pending jump: the document, the click (nonce; 0 for an opening page),
 * the page and, for an evidence jump, the citation it was armed for. */
export interface JumpToken<C extends object = object> {
  documentId: string;
  nonce: number;
  page: number;
  citation: C | null;
}

/** The jump a state arms, or null, which clears any pending jump: none before
 * this document's own pages have arrived (the previous document's pages stay
 * until then), none without a target page, and none without a click unless
 * it is the document's opening page. */
export function armJump<C extends object>(state: JumpState<C>): JumpToken<C> | null {
  if (state.pagesFor !== state.documentId || state.pages === 0 || !state.targetPage) return null;
  const nonce = state.nonce ?? 0;
  if (!nonce && (state.openingApplied || state.targetPage <= 1)) return null;
  return { documentId: state.documentId, nonce, page: state.targetPage, citation: nonce && state.evidence ? state.citation : null };
}

/** Whether a pending jump may still scroll: the current state arms the same
 * jump. A document switch, another click, or a citation that changed or was
 * cleared while the page bodies were mounting drops it, so a late jump never
 * scrolls another document or another citation. */
export function jumpApplies<C extends object>(jump: JumpToken<C>, armed: JumpToken<C> | null): boolean {
  return armed !== null && armed.documentId === jump.documentId && armed.nonce === jump.nonce
    && armed.page === jump.page && armed.citation === jump.citation;
}

export type JumpTarget = 'wait' | 'done' | 'anchor' | 'caption' | 'page';

/** Where a pending jump scrolls when its frame runs: nowhere before the bodies
 * are ready; nowhere when the cited passage's anchor already scrolled itself
 * (it is no longer pending); to that anchor when it mounted first; else to the
 * page caption, else the page start (a late anchor still scrolls itself). */
export function jumpTarget(state: {
  ready: boolean;
  citation: object | null;
  pendingAnchor: object | null;
  mountedAnchorFor: object | null;
  caption: boolean;
}): JumpTarget {
  if (!state.ready) return 'wait';
  if (state.citation && state.pendingAnchor !== state.citation) return 'done';
  if (state.citation && state.mountedAnchorFor === state.citation) return 'anchor';
  return state.caption ? 'caption' : 'page';
}

/** Whether an anchor mark that has just mounted scrolls itself into view: only
 * for the pending citation, and only once every body has mounted. */
export function anchorScrolls(state: { ready: boolean; citation: object; pendingAnchor: object | null }): boolean {
  return state.ready && state.pendingAnchor === state.citation;
}
