"use client";

import React from 'react';
import EditorialHeader from './EditorialHeader';
import EditorialFooter from './EditorialFooter';
import HeroSection from './HeroSection';
import FeatureGrid from './FeatureGrid';
import HowItWorks from './HowItWorks';
import SocialProof from './SocialProof';
import SecuritySection from './SecuritySection';
import FAQ from './FAQ';
import FinalCTA from './FinalCTA';

/**
 * The unauthenticated public landing surface. Uses the scoped editorial
 * design system (`.dt-editorial`) — warm-paper palette, Newsreader serif,
 * IBM Plex Mono. Light-only by design (see `.claude/rules/frontend.md`).
 *
 * Extracted from `HomePageClient.tsx` (Wave-2 Q27) so the unauth marketing
 * path and the authenticated dashboard live in separate files. The auth
 * router lives in `HomePageClient.tsx`, which picks between this component
 * and `<DashboardPageClient />` based on session status.
 */
export default function LandingPageContent() {
  return (
    <div className="dt-editorial">
      <EditorialHeader />
      <main>
        <HeroSection />
        <FeatureGrid />
        <HowItWorks />
        <SocialProof />
        <SecuritySection />
        <FAQ />
        <FinalCTA />
      </main>
      <EditorialFooter />
    </div>
  );
}
