"use client";

import dynamic from 'next/dynamic';
import PublicHeader from './PublicHeader';

interface HeaderProps {
  variant?: 'minimal' | 'full';
  isDemo?: boolean;
  isLoggedIn?: boolean;
}

const AppHeaderShell = dynamic(() => import('./AppHeaderShell'), {
  loading: () => <div className="h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-[var(--page-background)]" />,
});

export default function Header({ variant = 'full', isDemo, isLoggedIn }: HeaderProps) {
  if (variant === 'minimal') {
    return <PublicHeader />;
  }

  return <AppHeaderShell isDemo={isDemo} isLoggedIn={isLoggedIn} />;
}
