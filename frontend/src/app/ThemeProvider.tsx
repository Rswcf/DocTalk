"use client";

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

function LegacyThemeMigration() {
  useEffect(() => {
    try {
      if (localStorage.getItem('theme') === 'win98') {
        localStorage.setItem('theme', 'dark');
      }
    } catch {
      // Ignore storage access failures (private mode, SSR mismatch).
    }
  }, []);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem themes={['light', 'dark']}>
      <LegacyThemeMigration />
      {children}
    </NextThemesProvider>
  );
}
