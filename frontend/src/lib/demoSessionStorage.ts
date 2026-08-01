/**
 * Anonymous-demo session pointer, keyed per document in `sessionStorage` so a
 * returning page view re-adopts the same session instead of burning a fresh
 * `createSession` (5-per-5min IP cap; see useChatSession.ts). All operations
 * are try/catch-wrapped — storage-disabled environments (private browsing,
 * quota exceeded, disabled by policy) degrade to null/no-op, which falls
 * back to the normal create-per-view path rather than throwing.
 *
 * Lifecycle (owned by callers, not this module):
 * - write on every anon-demo session adoption/creation (initial create,
 *   reuse-adopt, "New Chat", session-switch — anywhere a response carries
 *   `demo_messages_used != null`)
 * - clear ONLY when the pointed-at session is confirmed gone/inaccessible
 *   (404/403); transient failures must NOT clear it, since a retry or the
 *   subsequent createSession fallback will overwrite it on success anyway
 */

function keyFor(documentId: string): string {
  return `dt-demo-session:${documentId}`;
}

export function readDemoSession(documentId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(keyFor(documentId));
  } catch {
    return null;
  }
}

export function writeDemoSession(documentId: string, sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(keyFor(documentId), sessionId);
  } catch {
    // storage disabled — no-op, next page view falls back to createSession
  }
}

export function clearDemoSession(documentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(keyFor(documentId));
  } catch {
    // storage disabled — nothing to clear
  }
}
