"use client";

import React from 'react';
import { useSession } from 'next-auth/react';
import LandingPageContent from '../components/landing/LandingPageContent';
import DashboardPageClient from '../components/dashboard/DashboardPageClient';

/**
 * Auth-aware shell for the root route. The previous 650-line file mixed
 * two unrelated product surfaces — the unauthenticated editorial landing
 * (warm-paper terracotta) and the authenticated dashboard (zinc+blue
 * upload zone, URL ingest, document list). They share nothing but this
 * session check, so they now live in separate files.
 *
 *   - Unauthenticated / loading  → `<LandingPageContent />`
 *     (`components/landing/LandingPageContent.tsx`)
 *   - Authenticated             → `<DashboardPageClient />`
 *     (`components/dashboard/DashboardPageClient.tsx`)
 *
 * During the `status === 'loading'` window we render the landing page,
 * matching the original pre-hydration UX (prevents a flash of dashboard
 * for not-yet-authenticated users). The Wave-1 C3/C5/Batch-A fixes live
 * with the dashboard component now — see its docblock.
 */
export default function HomePageClient() {
  const { status } = useSession();

  if (status === 'loading' || status === 'unauthenticated') {
    return <LandingPageContent />;
  }

  return <DashboardPageClient />;
}
