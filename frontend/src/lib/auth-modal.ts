export const AUTH_MODAL_HASH = '#auth';

export function isAuthModalHash(hash: string): boolean {
  return hash === AUTH_MODAL_HASH;
}

let callbackOverride: string | null = null;

export function openAuthModal(options?: { callbackUrl?: string }): void {
  if (typeof window === 'undefined') return;
  callbackOverride = options?.callbackUrl ?? null;
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

export function getUrlWithoutAuthHash(url: URL): string {
  return `${url.pathname}${url.search}`;
}
