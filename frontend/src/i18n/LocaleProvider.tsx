"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LocaleContext, Locale, LOCALES } from './index';
import { splitLocaleFromPath } from './routing';

import en from './locales/en.json';

function applyParams(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  let out = str;
  Object.entries(params).forEach(([k, v]) => {
    out = out.replace(`{${k}}`, String(v));
  });
  return out;
}

const warnedKeys = new Set<string>();
function warnMissing(key: string, suffix = '') {
  if (process.env.NODE_ENV !== 'development') return;
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[i18n] Missing translation key${suffix}:`, key);
}

const localeLoaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  zh: () => import('./locales/zh.json'),
  es: () => import('./locales/es.json'),
  ja: () => import('./locales/ja.json'),
  de: () => import('./locales/de.json'),
  fr: () => import('./locales/fr.json'),
  ko: () => import('./locales/ko.json'),
  pt: () => import('./locales/pt.json'),
  it: () => import('./locales/it.json'),
  ar: () => import('./locales/ar.json'),
  hi: () => import('./locales/hi.json'),
};

function detectLocale(): Locale {
  // A locale URL prefix (`/de/...`) is explicit intent — it wins over stored
  // preference and browser language, and keeps <html lang>/chrome in sync with
  // the server-rendered locale page.
  if (typeof window !== 'undefined') {
    const { locale } = splitLocaleFromPath(window.location.pathname);
    if (locale !== 'en' && LOCALES.some((l) => l.code === locale)) return locale as Locale;
  }

  const stored = typeof window !== 'undefined' ? localStorage.getItem('doctalk_locale') : null;
  if (stored && LOCALES.some((l) => l.code === stored)) return stored as Locale;

  if (typeof navigator !== 'undefined') {
    const nav = navigator.language;
    const prefix = nav.split('-')[0] as Locale;
    if (LOCALES.some((l) => l.code === prefix)) return prefix;
  }
  return 'en';
}

export default function LocaleProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: React.ReactNode;
  /**
   * Server-seeded locale + messages for localized server pages (e.g. the `/de`
   * landing). When provided, the provider starts in that locale with those
   * messages so the initial SSR HTML is translated — without client detection
   * and without shipping the full locale JSON. Missing keys still fall back to
   * the statically-bundled English. Omit both for the default app behavior
   * (start `en`, detect client-side).
   */
  initialLocale?: Locale;
  initialMessages?: Record<string, string>;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? 'en');
  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, Record<string, string>>>(
    // Never let a scoped seed clobber the full bundled English (resolve() relies
    // on it as the fallback); only seed a non-en locale.
    initialLocale && initialLocale !== 'en' && initialMessages
      ? { en, [initialLocale]: initialMessages }
      : { en },
  );

  useEffect(() => {
    // Seeded providers (localized server pages) keep their server locale; only
    // the default (unseeded) provider detects from storage/navigator/URL.
    if (initialLocale) return;
    setLocaleState(detectLocale());
  }, [initialLocale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('doctalk_locale', l);
    } catch {
      // localStorage unavailable in private browsing
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    const localeInfo = LOCALES.find((l) => l.code === locale);
    document.documentElement.dir = localeInfo?.dir === 'rtl' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    if (locale === 'en' || loadedTranslations[locale] || !localeLoaders[locale]) return;

    let cancelled = false;
    localeLoaders[locale]()
      .then((mod) => {
        if (cancelled) return;
        setLoadedTranslations((prev) => ({ ...prev, [locale]: mod.default }));
      })
      .catch((err) => {
        console.error(`Failed to load locale: ${locale}`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [locale, loadedTranslations]);

  const resolve = useCallback(
    (key: string): string | undefined => {
      const activeTranslations = loadedTranslations[locale] || loadedTranslations.en;
      return activeTranslations?.[key] ?? loadedTranslations.en?.[key];
    },
    [locale, loadedTranslations]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const translated = resolve(key);
      if (translated == null) warnMissing(key);
      return applyParams(translated ?? key, params);
    },
    [resolve]
  );

  const tOr = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>): string => {
      const translated = resolve(key);
      if (translated == null) warnMissing(key, ' (using fallback)');
      return applyParams(translated ?? fallback, params);
    },
    [resolve]
  );

  const value = useMemo(() => ({ locale, setLocale, t, tOr }), [locale, setLocale, t, tOr]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
