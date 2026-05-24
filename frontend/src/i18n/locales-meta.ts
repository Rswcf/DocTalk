/**
 * Framework-neutral locale metadata — NO "use client", so it can be imported by
 * both server and client components. The client context + `useLocale` hook live
 * in `./index` (which re-exports these for backward compatibility). Server
 * components (e.g. MarketingLocaleLinks) must import LOCALES from HERE, not from
 * `./index` — importing a runtime value out of a "use client" module into a
 * server component turns it into a client reference and crashes at prerender.
 */
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
