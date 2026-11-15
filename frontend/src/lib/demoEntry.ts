// This small, synchronous head script runs before a visitor can follow a
// server-rendered link. A native navigation discards React's module memory.
// Carry only a channel, a public landing path and the QA flag in the fragment.
export type DemoOrigin = { source: string; landing: string; qa: boolean };

declare global {
  interface Window { docTalkDemoOrigin?: DemoOrigin }
}

export function installDemoEntry(ignoredHosts: string[] = []) {
  const url = new URL(location.href);
  const params = url.searchParams;
  const ref = document.referrer ? new URL(document.referrer) : null;
  const host = ref?.hostname.replace(/^(www\.|m\.)/, '') || '';
  const medium = params.get('utm_medium')?.toLowerCase() || '';
  let source = 'direct_unknown';
  if (/^(cpc|ppc|paid|paidsearch|paid_search)$/.test(medium)) source = 'paid';
  else if (/^google\.(com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host)) source = 'google';
  else if (host === 'bing.com') source = 'bing';
  else if (/^(duckduckgo\.com|search\.yahoo\.com|search\.brave\.com|ecosia\.org|search\.yahoo\.co\.jp)$/.test(host)) source = 'other_search';
  else if (/^(chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/.test(host)) source = 'ai';
  else if (params.has('utm_source')) source = 'campaign';
  else if (ref && ref.origin !== url.origin && !ignoredHosts.includes(ref.hostname)
    && !/(^|\.)doctalk\.site$/.test(host) && !(host.endsWith('.vercel.app') && host.includes('doctalk'))) source = 'referral';

  const publicPath = /^\/(?:(?:zh|ja|es|ko|de|fr|pt|it|ar|hi)(?:\/|$))?(?:(?:use-cases|compare|alternatives|features|tools|demo)(?:\/[a-z0-9-]{1,80})?|blog(?:\/category)?(?:\/[a-z0-9-]{1,80})?|pricing|trust|about|contact|imprint|privacy|terms)?$/;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  let landing = publicPath.test(path) ? path : path.startsWith('/d/') ? '/d/*' : '/*';
  let qa = params.get('utm_campaign') === 'doctalk-qa';
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (url.hash.startsWith('#dt_from=') && ref?.origin === url.origin) {
    const from = fragment.get('dt_from') || '';
    const via = fragment.get('dt_via') || '';
    if (publicPath.test(from) && /^(google|bing|other_search|ai|paid|campaign|referral|direct_unknown)$/.test(via)) {
      landing = from;
      source = via;
      qa = fragment.has('dt_qa');
    }
  }
  window.docTalkDemoOrigin = { source, landing, qa };
  function carry(event: Event) {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(link instanceof HTMLAnchorElement) || !publicPath.test(landing)) return;
    const dest = new URL(link.href);
    if (dest.origin !== location.origin || (dest.hash && !dest.hash.startsWith('#dt_from='))) return;
    const demo = /^\/(?:[a-z]{2}\/)?demo(?:\/|$)/;
    if (!demo.test(dest.pathname) && !(demo.test(location.pathname) && dest.pathname.startsWith('/d/'))) return;
    const handoff = new URLSearchParams({ dt_from: landing, dt_via: source });
    if (qa) handoff.set('dt_qa', '1');
    dest.hash = handoff.toString();
    link.href = dest.href;
  }
  document.addEventListener('click', carry, true);
  document.addEventListener('auxclick', carry, true);
}
