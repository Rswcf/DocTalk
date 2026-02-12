"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LocaleContext, Locale, LOCALES } from './index';

import en from './locales/en.json';

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
  const stored = typeof window !== 'undefined' ? localStorage.getItem('doctalk_locale') : null;
  if (stored && LOCALES.some((l) => l.code === stored)) return stored as Locale;

  if (typeof navigator !== 'undefined') {
    const nav = navigator.language;
    const prefix = nav.split('-')[0] as Locale;
    if (LOCALES.some((l) => l.code === prefix)) return prefix;
  }
  return 'en';
}

export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, Record<string, string>>>({ en });

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

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

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const activeTranslations = loadedTranslations[locale] || loadedTranslations.en;
      const translated = activeTranslations?.[key] ?? loadedTranslations.en?.[key];
      let str = translated ?? key;

      if (translated == null && process.env.NODE_ENV === 'development') {
        console.warn('[i18n] Missing translation key:', key);
      }

      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          str = str.replace(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [locale, loadedTranslations]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
