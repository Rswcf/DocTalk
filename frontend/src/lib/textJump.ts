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
