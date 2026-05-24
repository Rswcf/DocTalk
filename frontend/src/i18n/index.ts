"use client";
import { createContext, useContext } from 'react';
import type { Locale } from './locales-meta';

// Re-export the framework-neutral metadata so existing imports
// (`import { LOCALES, Locale } from './index'`) keep working unchanged.
export { LOCALES } from './locales-meta';
export type { Locale, LocaleInfo } from './locales-meta';

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  tOr: (_key, fallback) => fallback,
});

export function useLocale() {
  return useContext(LocaleContext);
}

