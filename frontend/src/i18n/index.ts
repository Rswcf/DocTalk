"use client";
import { createContext, useContext } from 'react';

export type Locale = 'en' | 'zh' | 'es' | 'ja' | 'de' | 'fr' | 'ko' | 'pt' | 'it' | 'ar' | 'hi';

export interface LocaleInfo {
  code: Locale;
  label: string;
  dir?: 'rtl' | 'ltr';
}

export const LOCALES: LocaleInfo[] = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'ja', label: '日本語' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ko', label: '한국어' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'hi', label: 'हिन्दी' },
];

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function useLocale() {
  return useContext(LocaleContext);
}

