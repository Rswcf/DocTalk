"use client";
import { createContext, useContext } from 'react';

export type Locale = 'en' | 'zh' | 'es' | 'fr' | 'de' | 'ar' | 'bn' | 'hi' | 'pt';

export interface LocaleInfo {
  code: Locale;
  label: string;
  flag: string;
  dir?: 'rtl' | 'ltr';
}

export const LOCALES: LocaleInfo[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
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

