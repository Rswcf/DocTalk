import { useEffect } from 'react';
import { GeistSans } from 'geist/font/sans';

/**
 * Night: the marketing surface's one theme (owner decisions 2026-09-21 —
 * prototype B for the landing, then every marketing page). Both marketing
 * roots, LandingPageContent and MarketingShell, render with this class, in
 * both OS themes. editorial.css resolves it to the dark `--ed-*` set (the
 * `.dark .dt-editorial` twins) plus one night-only block: the #0a0908 stage,
 * the darker glass, and the display family.
 *
 * Geist is the night display family. It is imported here and nowhere else, so
 * only routes that render a marketing root preload it (tests/landing-night
 * .test.cjs pins the single importer).
 */
export const NIGHT_ROOT_CLASS = `dt-editorial dt-night ${GeistSans.variable}`;

// The night stage, `--ed-paper` under `.dt-night`. A literal because the meta
// tags live in <head>, outside any element that could resolve the token.
export const NIGHT_THEME_COLOR = '#0a0908';

/**
 * Tint the browser chrome to the night stage while a marketing root is
 * mounted. layout.tsx declares theme-color per OS scheme (paper for light),
 * which would paint a pale toolbar over a dark page. A page-level `viewport`
 * export can't do this: the signed-in dashboard renders at `/` too and keeps
 * the app's colours, so the tags are swapped on mount and restored on unmount.
 */
export function useNightThemeColor() {
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const previous = metas.map((m) => m.content);
    metas.forEach((m) => {
      m.content = NIGHT_THEME_COLOR;
    });
    return () => {
      metas.forEach((m, i) => {
        m.content = previous[i];
      });
    };
  }, []);
}
