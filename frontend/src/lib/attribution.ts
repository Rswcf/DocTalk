// First-touch attribution that does not depend on cookie consent.
//
// GA4 and Vercel Analytics load only after the visitor accepts cookies
// (AnalyticsWrapper), so the 2026-09-30 audit could not tell a real arrivals
// drop from a capture drop. This records where the visit came from — the
// referring site's hostname, any utm_* tags and the kind of page the visit
// landed on — and attaches it to the pre-signup funnel events in
// lib/analytics.ts, which go to our own /api/events.
//
// It keeps the values in module memory only: nothing is written to cookies,
// localStorage or sessionStorage, and no device identifier is created. Module
// memory survives App Router client navigation and is reset by a full page
// load, which is what "first touch of this visit" should mean. (Events from a
// signed-in visitor carry their user_id, like every other product event; the
// privacy page says so.)
//
// Every value is sanitized so it cannot carry personal data: the landing path
// is kept only for public marketing routes and collapsed to its route pattern
// otherwise (no document ids or share tokens), and utm values must be short
// slug-like tokens (no emails, long digit runs or path/query characters).

export type Attribution = {
  ref_host?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing_path?: string;
};

// Events that carry attribution. Only the pre-signup funnel needs it.
export const ATTRIBUTED_EVENTS = new Set([
  'landing_cta_clicked',
  'auth_modal_opened',
  'auth_provider_clicked',
]);

// Hops that bring a visitor back rather than send one: sign-in providers,
// payment return pages and webmail (magic-link emails).
const IGNORED_REFERRER_HOSTS = new Set([
  'accounts.google.com',
  'accounts.youtube.com',
  'login.microsoftonline.com',
  'login.microsoft.com',
  'login.live.com',
  'checkout.stripe.com',
  'billing.stripe.com',
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'mail.yahoo.com',
  'mail.proton.me',
  'mail.qq.com',
  'mail.163.com',
]);

const OWN_DOMAIN = 'doctalk.site';
const URL_LOCALE = '(?:zh|ja|es|ko|de|fr|pt|it|ar|hi)';
const SLUG = '[a-z0-9-]{1,80}';

// Public marketing routes whose path is safe to keep as-is.
const PUBLIC_PATH = new RegExp(
  `^(?:/${URL_LOCALE})?(?:/|` +
    `/(?:use-cases|compare|alternatives|features|tools)(?:/${SLUG})?|` +
    `/blog(?:/category)?(?:/${SLUG})?|` +
    `/demo(?:/${SLUG})?|` +
    `/(?:pricing|trust|about|contact|imprint|privacy|terms))$`,
);

const MAX_LEN = 64;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

let captured: Attribution | null = null;

function isOwnHost(host: string): boolean {
  if (host === OWN_DOMAIN || host.endsWith(`.${OWN_DOMAIN}`)) return true;
  // Vercel preview deployments of this project.
  return host.endsWith('.vercel.app') && host.includes('doctalk');
}

export function referrerHost(referrer: string, currentHost: string): string | undefined {
  if (!referrer) return undefined;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  const host = url.hostname.toLowerCase();
  if (!host || host.length > MAX_LEN) return undefined;
  const bare = (h: string) => h.replace(/^www\./, '');
  if (bare(host) === bare(currentHost.toLowerCase()) || isOwnHost(host)) return undefined;
  if (IGNORED_REFERRER_HOSTS.has(host)) return undefined;
  return host;
}

// A utm value survives only if it is a short slug-like token. Anything that
// could be personal (an email, a phone or account number, a UUID-style id) or
// that looks like a path/query is dropped rather than stored.
export function safeUtm(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (!SAFE_TOKEN.test(v)) return undefined;
  if (/\d{6,}/.test(v)) return undefined;
  if (/[0-9a-f]{16,}/.test(v.replace(/[-_.]/g, ''))) return undefined;
  return v;
}

// Public marketing paths are kept; anything else collapses to its first
// segment plus "/*", so /d/<document-id> becomes "/d/*" and
// /shared/<token> becomes "/shared/*".
export function safeLandingPath(pathname: string): string | undefined {
  const p = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (PUBLIC_PATH.test(p)) return p;
  const first = p.split('/')[1];
  if (!first || !/^[a-z0-9-]{1,40}$/.test(first)) return '/*';
  return p.split('/').length > 2 ? `/${first}/*` : `/${first}`;
}

export function readAttribution(referrer: string, href: string): Attribution {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return {};
  }
  const params = url.searchParams;
  const result: Attribution = {
    ref_host: referrerHost(referrer, url.hostname),
    utm_source: safeUtm(params.get('utm_source')),
    utm_medium: safeUtm(params.get('utm_medium')),
    utm_campaign: safeUtm(params.get('utm_campaign')),
    landing_path: safeLandingPath(url.pathname),
  };
  for (const key of Object.keys(result) as (keyof Attribution)[]) {
    if (result[key] === undefined) delete result[key];
  }
  return result;
}

export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  if (captured === null) {
    try {
      captured = readAttribution(document.referrer, window.location.href);
    } catch {
      captured = {};
    }
  }
  return captured;
}

// Capture as early as the module is evaluated in the browser, so a later
// client-side navigation cannot change landing_path or drop the utm tags.
if (typeof window !== 'undefined') getAttribution();
