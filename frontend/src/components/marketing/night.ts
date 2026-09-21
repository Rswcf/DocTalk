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
 * Dress the document for Night while a marketing root is mounted, and undo it
 * on unmount (the signed-in dashboard renders at `/` too and keeps the app's
 * colours, so none of this can be a static page export):
 *  - theme-color: layout.tsx declares it per OS scheme (paper for light),
 *    which would paint a pale toolbar over a dark page;
 *  - `dt-night-doc` on <html>: editorial.css paints <html>/<body> the night
 *    stage and sets `color-scheme: dark`, so overscroll bands and the page
 *    scrollbar are dark too.
 */
// Reference-counted across roots: two marketing pages can overlap during a
// client navigation (the next one mounted before the last one unmounts), so
// the ORIGINAL values are captured by the first mount and restored only by
// the last unmount, whatever the order.
let mountedRoots = 0;
let originalThemeColors: string[] | null = null;

export function useNightDocument() {
  useEffect(() => {
    const root = document.documentElement;
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    if (mountedRoots === 0) originalThemeColors = metas.map((m) => m.content);
    mountedRoots += 1;
    metas.forEach((m) => {
      m.content = NIGHT_THEME_COLOR;
    });
    root.classList.add('dt-night-doc');
    return () => {
      mountedRoots -= 1;
      if (mountedRoots > 0) return;
      metas.forEach((m, i) => {
        if (originalThemeColors) m.content = originalThemeColors[i];
      });
      originalThemeColors = null;
      root.classList.remove('dt-night-doc');
    };
  }, []);
}
