type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (command: 'event', eventName: string, params?: EventParams) => void;
  }
}

export function trackEvent(eventName: string, params: EventParams = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.gtag?.('event', eventName, params);
    void fetch('/api/proxy/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: eventName, properties: params }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never block the user flow.
  }
}
