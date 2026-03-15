export const AUTH_MODAL_HASH = '#auth';

export function isAuthModalHash(hash: string): boolean {
  return hash === AUTH_MODAL_HASH;
}

export function openAuthModal(): void {
  if (typeof window === 'undefined') return;
  if (window.location.hash === AUTH_MODAL_HASH) return;
  window.location.hash = AUTH_MODAL_HASH.slice(1);
}

export function getUrlWithoutAuthHash(url: URL): string {
  return `${url.pathname}${url.search}`;
}
