// First-touch attribution that does not depend on cookie consent.
//
// GA4 and Vercel Analytics load only after the visitor accepts cookies
// (AnalyticsWrapper), so the 2026-09-30 audit could not tell a real arrivals
// drop from a capture drop. This records where the visit came from — the
// referring site's hostname and any utm_* tags — and attaches it to the
// funnel events in lib/analytics.ts, which go to our own /api/events.
//
// It keeps the values in module memory only: nothing is written to cookies,
// localStorage or sessionStorage, and nothing identifies the visitor. Module
// memory survives App Router client navigation and is reset by a full page
// load, which is what "first touch of this visit" should mean.

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

// Referrers that are our own hosts or an auth hop, not a traffic source.
// A sign-in round trip reloads the page with the provider as referrer.
const IGNORED_REFERRER_HOSTS = new Set([
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
]);

const MAX_LEN = 64;

let captured: Attribution | null = null;

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_LEN);
  return trimmed || undefined;
}

export function referrerHost(referrer: string, currentHost: string): string | undefined {
  if (!referrer) return undefined;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  const bare = (h: string) => h.replace(/^www\./, '');
  if (!host || bare(host) === bare(currentHost.toLowerCase())) return undefined;
  if (IGNORED_REFERRER_HOSTS.has(host)) return undefined;
  return clean(host);
}

export function readAttribution(
  referrer: string,
  href: string,
): Attribution {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return {};
  }
  const params = url.searchParams;
  const result: Attribution = {
    ref_host: referrerHost(referrer, url.hostname),
    utm_source: clean(params.get('utm_source')),
    utm_medium: clean(params.get('utm_medium')),
    utm_campaign: clean(params.get('utm_campaign')),
    landing_path: clean(url.pathname),
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
