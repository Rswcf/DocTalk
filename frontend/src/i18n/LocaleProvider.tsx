"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LocaleContext, Locale, LOCALES } from './index';

import en from './locales/en.json';
import zh from './locales/zh.json';
import es from './locales/es.json';
import ja from './locales/ja.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';

const translations: Record<Locale, Record<string, string>> = { en, zh, es, ja, de, fr, ko, pt, it, ar, hi };

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

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('doctalk_locale', l);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    const localeInfo = LOCALES.find((l) => l.code === locale);
    document.documentElement.dir = localeInfo?.dir === 'rtl' ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let str = translations[locale]?.[key] || translations['en']?.[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          str = str.replace(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

