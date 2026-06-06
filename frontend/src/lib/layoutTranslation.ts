import { PROXY_BASE } from './api';

export interface LayoutTranslationTarget {
  value: string;
  label: string;
}

export const LAYOUT_TRANSLATION_TARGETS: LayoutTranslationTarget[] = [
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];

export function layoutTranslationTargetLabel(value?: string | null): string {
  return LAYOUT_TRANSLATION_TARGETS.find((target) => target.value === value)?.label
    || LAYOUT_TRANSLATION_TARGETS[0].label;
}

export function proxiedArtifactUrl(url: string): string {
  if (!url) return '#';
  if (/^https?:\/\//.test(url)) return url;
  return `${PROXY_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

export function absoluteProxiedArtifactUrl(url: string): string {
  const proxied = proxiedArtifactUrl(url);
  if (/^https?:\/\//.test(proxied)) return proxied;
  if (typeof window === 'undefined') return proxied;
  return `${window.location.origin}${proxied.startsWith('/') ? proxied : `/${proxied}`}`;
}
