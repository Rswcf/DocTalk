"use client";

import React from 'react';
import { NIGHT_ROOT_CLASS, useNightThemeColor } from '../marketing/night';
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
 * The owner then asked for prototype B's deeper ground and its sans display
 * type, and then for Night on every marketing page: the class, the Geist
 * font and the theme-color hook live in components/marketing/night.ts, shared
 * with MarketingShell.
 *
 * Extracted from `HomePageClient.tsx` (Wave-2 Q27) so the unauth marketing
 * path and the authenticated dashboard live in separate files. The auth
 * router lives in `HomePageClient.tsx`, which picks between this component
 * and `<DashboardPageClient />` based on session status.
 */
export default function LandingPageContent() {
  useNightThemeColor();

  return (
    <div className={NIGHT_ROOT_CLASS}>
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
