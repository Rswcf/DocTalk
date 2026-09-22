export const AUTH_MODAL_HASH = '#auth';

export function isAuthModalHash(hash: string): boolean {
  return hash === AUTH_MODAL_HASH;
}

let callbackOverride: string | null = null;
// Where the modal was opened from, reported once on `auth_modal_opened`
// (e.g. `citation_save` from the reader's Save quote); cleared on close.
let sourceOverride: string | null = null;

export function openAuthModal(options?: { callbackUrl?: string; source?: string }): void {
  if (typeof window === 'undefined') return;
  callbackOverride = options?.callbackUrl ?? null;
  sourceOverride = options?.source ?? null;
  if (window.location.hash === AUTH_MODAL_HASH) return;
  window.location.hash = AUTH_MODAL_HASH.slice(1);
}

/** Read (without clearing) the override set by the most recent openAuthModal call.
 *  Cleared when the modal closes so a later hash-open falls back to current-URL. */
export function peekAuthCallbackOverride(): string | null {
  return callbackOverride;
}

export function clearAuthCallbackOverride(): void {
  callbackOverride = null;
}

export function peekAuthSourceOverride(): string | null {
  return sourceOverride;
}

export function clearAuthSourceOverride(): void {
  sourceOverride = null;
}

export function getUrlWithoutAuthHash(url: URL): string {
  return `${url.pathname}${url.search}`;
}
