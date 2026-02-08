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
    <Suspense fallback={<SkeletonFallback />}>
      <LazyShowcase isDark={isDark} />
    </Suspense>
  );
}
