"use client";

import dynamic from 'next/dynamic';
import PublicHeader from './PublicHeader';

interface HeaderProps {
  variant?: 'minimal' | 'full';
  isDemo?: boolean;
  isLoggedIn?: boolean;
}

const AppHeaderShell = dynamic(() => import('./AppHeaderShell'), {
  loading: () => <div className="dt-shell-header h-14 shrink-0 border-b" />,
});

export default function Header({ variant = 'full', isDemo, isLoggedIn }: HeaderProps) {
  if (variant === 'minimal') {
    return <PublicHeader />;
  }

  return <AppHeaderShell isDemo={isDemo} isLoggedIn={isLoggedIn} />;
}
