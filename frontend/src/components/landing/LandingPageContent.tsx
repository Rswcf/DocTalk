"use client";

import React, { useEffect } from 'react';
import EditorialHeader from './EditorialHeader';
import EditorialFooter from './EditorialFooter';
import HeroSection from './HeroSection';
import FeatureGrid from './FeatureGrid';
import HowItWorks from './HowItWorks';
import SecuritySection from './SecuritySection';
import FAQ from './FAQ';
import FinalCTA from './FinalCTA';

/**
 * The unauthenticated public landing surface, on the scoped editorial design
 * system (`.dt-editorial`: Fraunces display, IBM Plex Sans text, the `--ed-*`
 * tokens).
 *
 * Night (plan .collab/plans/2026-09-21-landing-night.md; the owner chose
 * prototype B): the root also carries `.dt-night`, which applies the dark
 * `--ed-*` values in BOTH OS themes. editorial.css gives every
 * `.dark .dt-editorial` selector a `.dt-editorial.dt-night` twin, so this
 * page is the editorial dark theme, not a second design. Chrome rendered
 * outside this root (the cookie banner, the language popover) mirrors the
 * class itself. Every other marketing page stays paper in a light OS.
 *
 * Extracted from `HomePageClient.tsx` (Wave-2 Q27) so the unauth marketing
 * path and the authenticated dashboard live in separate files. The auth
 * router lives in `HomePageClient.tsx`, which picks between this component
 * and `<DashboardPageClient />` based on session status.
 */
export default function LandingPageContent() {
  useNightThemeColor();

  return (
    <div className="dt-editorial dt-night">
      <EditorialHeader />
      <main>
        <HeroSection />
        <FeatureGrid />
        <HowItWorks />
        <SecuritySection />
        <FAQ />
        <FinalCTA />
      </main>
      <EditorialFooter />
    </div>
  );
}

// The dark stage, `--ed-paper` under `.dt-night`. A literal because the meta
// tags live in <head>, outside any element that could resolve the token.
const NIGHT_THEME_COLOR = '#171614';

/**
 * Tint the browser chrome to the night stage while the landing is mounted.
 * layout.tsx declares theme-color per OS scheme (paper for light), which would
 * paint a pale toolbar over a dark page. A page-level `viewport` export can't
 * do this: the signed-in dashboard renders at the same route and must keep
 * the paper colour, so the tags are swapped on mount and restored on unmount.
 */
function useNightThemeColor() {
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const previous = metas.map((m) => m.content);
    metas.forEach((m) => { m.content = NIGHT_THEME_COLOR; });
    return () => {
      metas.forEach((m, i) => { m.content = previous[i]; });
    };
  }, []);
}
