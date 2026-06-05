/**
 * Server-side translation resolver — the SEO counterpart to the client
 * `LocaleProvider`. Server components call `getServerT(locale)` so the INITIAL
 * server-rendered HTML for a locale URL (`/de/...`) already contains the
 * translated text, making it indexable by crawlers that don't run JS.
 *
 * Only imported by server components. Mirrors the client API: same
 * `applyParams` placeholder substitution and the same en-fallback for any
 * missing key. Under SSG the locale JSON is loaded at build time, so the
 * payload is static HTML and the 400KB+ JSON never ships to the client.
 */
import en from './locales/en.json';

type Messages = Record<string, string>;

// Loaders for the locales that have server-rendered URLs (URL_LOCALES).
const loaders: Record<string, () => Promise<{ default: Messages }>> = {
  zh: () => import('./locales/zh.json'),
  ja: () => import('./locales/ja.json'),
  es: () => import('./locales/es.json'),
  ko: () => import('./locales/ko.json'),
  de: () => import('./locales/de.json'),
  fr: () => import('./locales/fr.json'),
  pt: () => import('./locales/pt.json'),
  it: () => import('./locales/it.json'),
  ar: () => import('./locales/ar.json'),
  hi: () => import('./locales/hi.json'),
};

function applyParams(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  let out = str;
  Object.entries(params).forEach(([k, v]) => {
    out = out.replace(`{${k}}`, String(v));
  });
  return out;
}

export interface ServerTranslator {
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
}

/**
 * Resolve a locale's messages limited to the given key prefixes. Used to seed a
 * client LocaleProvider for a localized server page (e.g. the landing) with just
 * the namespaces that page's tree uses — translated SSR without shipping the full
 * 400KB locale JSON. Falls back to English for the locale's missing keys.
 */
export async function getScopedMessages(
  locale: string,
  prefixes: readonly string[],
): Promise<Record<string, string>> {
  const enMessages = en as Messages;
  let messages: Messages = enMessages;
  if (locale !== 'en' && loaders[locale]) {
    try {
      messages = (await loaders[locale]()).default;
    } catch {
      messages = enMessages;
    }
  }
  const out: Record<string, string> = {};
  for (const key of Object.keys(enMessages)) {
    if (prefixes.some((p) => key.startsWith(p))) {
      out[key] = messages[key] ?? enMessages[key];
    }
  }
  return out;
}

export async function getServerT(locale: string): Promise<ServerTranslator> {
  const enMessages = en as Messages;
  let messages: Messages = enMessages;

  if (locale !== 'en' && loaders[locale]) {
    try {
      messages = (await loaders[locale]()).default;
    } catch {
      messages = enMessages;
    }
  }

  const resolve = (key: string): string | undefined => messages[key] ?? enMessages[key];

  return {
    locale,
    t: (key, params) => applyParams(resolve(key) ?? key, params),
    tOr: (key, fallback, params) => applyParams(resolve(key) ?? fallback, params),
  };
}
