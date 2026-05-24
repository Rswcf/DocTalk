/**
 * Locale URL routing helpers — framework-neutral (safe in both server and
 * client components; no "use client", no server-only imports).
 *
 * International-SEO model (see .collab/plans/2026-05-24-international-seo-locale-urls-spec.md):
 *   - English is the DEFAULT and lives at the root with NO prefix (`/use-cases/lawyers`).
 *     Keeping English unprefixed means existing URLs/rankings need no 301s.
 *   - The high-value locales below get a subdirectory prefix (`/de/use-cases/lawyers`)
 *     with server-rendered translated HTML, so search engines can index each language.
 *   - `zh/it/ar/hi` content exists but has no localized URLs yet (deferred); they remain
 *     available via the client-side locale toggle on the app surface.
 */

// Locales that have crawlable, server-rendered marketing URLs (en is the unprefixed default).
export const URL_LOCALES = ['ja', 'es', 'ko', 'de', 'fr', 'pt'] as const;
export type UrlLocale = (typeof URL_LOCALES)[number];

// All locales that participate in hreflang (the unprefixed default + the prefixed set).
export const MARKETING_LOCALES = ['en', ...URL_LOCALES] as const;

export function isUrlLocale(value: string | undefined | null): value is UrlLocale {
  return !!value && (URL_LOCALES as readonly string[]).includes(value);
}

/**
 * Locale-agnostic marketing paths that actually have server-rendered locale
 * variants under `app/[locale]/...`. This is the single source of truth that
 * keeps links/hreflang/sitemap honest — a path is only ever prefixed once its
 * localized page exists, so we never emit a `/de/...` link that 404s.
 * Grows as pages are localized (Phase A: lawyers only).
 */
export const LOCALIZED_PATHS: ReadonlySet<string> = new Set<string>([
  '/use-cases/lawyers',
]);

/** Normalize a path for matching: drop query/hash and a single trailing slash (except root). */
function normalizePath(path: string): string {
  const clean = (path.startsWith('/') ? path : `/${path}`).split(/[?#]/)[0];
  return clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
}

export function isLocalizedPath(path: string): boolean {
  return LOCALIZED_PATHS.has(normalizePath(path));
}

/**
 * Prefix a locale-agnostic path for a given locale.
 * `en` (or any non-URL locale) returns the path unchanged, so English output is byte-stable.
 *   localizedHref('de', '/use-cases/lawyers') -> '/de/use-cases/lawyers'
 *   localizedHref('de', '/')                  -> '/de'
 *   localizedHref('en', '/pricing')           -> '/pricing'
 */
export function localizedHref(locale: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (!isUrlLocale(locale)) return clean;
  if (clean === '/') return `/${locale}`;
  return `/${locale}${clean}`;
}

/**
 * Like `localizedHref`, but only prefixes paths that actually have a localized
 * page (`LOCALIZED_PATHS`). Use this for links/CTAs that may point at pages not
 * yet localized — they stay on the English URL instead of 404ing.
 */
export function localizedHrefIfAvailable(locale: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return isLocalizedPath(clean) ? localizedHref(locale, normalizePath(clean)) : clean;
}

/**
 * Split a known locale prefix off a pathname.
 *   '/de/use-cases/lawyers' -> { locale: 'de', path: '/use-cases/lawyers' }
 *   '/use-cases/lawyers'    -> { locale: 'en', path: '/use-cases/lawyers' }
 *   '/de'                   -> { locale: 'de', path: '/' }
 */
export function splitLocaleFromPath(pathname: string): { locale: string; path: string } {
  const clean = normalizePath(pathname || '/');
  const m = clean.match(/^\/([a-z]{2})(\/.*)?$/);
  if (m && isUrlLocale(m[1])) {
    return { locale: m[1], path: m[2] && m[2].length > 0 ? m[2] : '/' };
  }
  return { locale: 'en', path: clean };
}
