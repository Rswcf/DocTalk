export const AUTH_MODAL_HASH = '#auth';

export function isAuthModalHash(hash: string): boolean {
  return hash === AUTH_MODAL_HASH;
}

/**
 * Where a guest met the sign-in wall (a short slug such as `quote_finder_toolbar`
 * or `demo_limit_panel`). `auth_modal_opened` and `auth_provider_clicked` carry
 * it as `location`, so the funnel shows which wall brings sign-ups. A modal
 * opened by a bare `#auth` link or `?auth=1` reports `direct`.
 */
export type AuthModalLocation = string;

type AuthModalContext = {
  callbackUrl: string | null;
  location: AuthModalLocation | null;
  /** Name of the file kept for after sign-in (lib/pendingUpload.ts). */
  pendingFileName: string | null;
  /** The visitor picked a file but this browser would not keep it. */
  fileNotKept: boolean;
};

const EMPTY: AuthModalContext = { callbackUrl: null, location: null, pendingFileName: null, fileNotKept: false };
let context: AuthModalContext = EMPTY;

export function openAuthModal(options?: {
  callbackUrl?: string;
  location?: AuthModalLocation;
  pendingFileName?: string;
  fileNotKept?: boolean;
}): void {
  if (typeof window === 'undefined') return;
  context = {
    callbackUrl: options?.callbackUrl ?? null,
    location: options?.location ?? null,
    pendingFileName: options?.pendingFileName ?? null,
    fileNotKept: options?.fileNotKept ?? false,
  };
  if (window.location.hash === AUTH_MODAL_HASH) return;
  window.location.hash = AUTH_MODAL_HASH.slice(1);
}

/**
 * For `<a href="#auth">` links that must stay native anchors (their hash
 * change is what opens the modal): call from the click handler, before the
 * navigation, so the modal still learns where it was opened from.
 */
export function noteAuthModalLocation(location: AuthModalLocation): void {
  context = { ...EMPTY, location };
}

/** Read (without clearing) the override set by the most recent openAuthModal call.
 *  Cleared when the modal closes so a later hash-open falls back to current-URL. */
export function peekAuthCallbackOverride(): string | null {
  return context.callbackUrl;
}

export function peekAuthModalLocation(): AuthModalLocation {
  return context.location ?? 'direct';
}

export function peekAuthModalPendingFileName(): string | null {
  return context.pendingFileName;
}

export function peekAuthModalFileNotKept(): boolean {
  return context.fileNotKept;
}

/** Clears everything openAuthModal set (callback override, location, file name). */
export function clearAuthCallbackOverride(): void {
  context = EMPTY;
}

export function getUrlWithoutAuthHash(url: URL): string {
  return `${url.pathname}${url.search}`;
}
