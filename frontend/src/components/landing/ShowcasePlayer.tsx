"use client";

import React, { lazy, Suspense, useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Lazy load the entire player + composition wrapper
const LazyShowcase = lazy(() => import("./ShowcasePlayerInner"));

function SkeletonFallback() {
  return (
    <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-sm" />
  );
}

function StaticFallback() {
  return (
    <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-sm flex items-center justify-center">
      <p className="text-sm text-zinc-400">Product demo unavailable</p>
    </div>
  );
}

class ShowcaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <StaticFallback />;
    }
    return this.props.children;
  }
}

export default function ShowcasePlayer() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  if (!mounted) {
    return <SkeletonFallback />;
  }

  return (
    <ShowcaseErrorBoundary>
      <Suspense fallback={<SkeletonFallback />}>
        <LazyShowcase isDark={isDark} />
      </Suspense>
    </ShowcaseErrorBoundary>
  );
}
