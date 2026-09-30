import { ATTRIBUTED_EVENTS, getAttribution, safeLandingPath } from './attribution';

type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (command: 'event', eventName: string, params?: EventParams) => void;
  }
}

export function trackEvent(eventName: string, params: EventParams = {}) {
  if (typeof window === 'undefined') return;
  try {
    // The pre-signup funnel events are sent without consent, so their path is
    // bucketed like landing_path (no document ids or share tokens).
    const attributed = ATTRIBUTED_EVENTS.has(eventName);
    const safeParams: EventParams = {
      path: attributed ? safeLandingPath(window.location.pathname) : window.location.pathname,
      ...(attributed ? getAttribution() : {}),
      ...params,
    };
    window.gtag?.('event', eventName, safeParams);
    void fetch('/api/proxy/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: eventName, properties: safeParams }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never block the user flow.
  }
}
