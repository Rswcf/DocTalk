"use client";

import React from 'react';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDocTalkStore } from '../store';
import DocTalkLogo from './DocTalkLogo';
import ModeSelector from './ModeSelector';
import ThemeSelector from './ThemeSelector';
import LanguageSelector from './LanguageSelector';
import UserMenu from './UserMenu';
import { useLocale } from '../i18n';
import SessionDropdown from './SessionDropdown';
import { CreditsDisplay } from './CreditsDisplay';

interface HeaderProps {
  variant?: 'minimal' | 'full';
  isDemo?: boolean;
  isLoggedIn?: boolean;
}

export default function Header({ variant = 'full', isDemo, isLoggedIn }: HeaderProps) {
  const documentName = useDocTalkStore((s) => s.documentName);
  const lastDocumentId = useDocTalkStore((s) => s.lastDocumentId);
  const lastDocumentName = useDocTalkStore((s) => s.lastDocumentName);
  const { resolvedTheme } = useTheme();
  const { t } = useLocale();
  const pathname = usePathname();
  const isDocumentPage = pathname?.startsWith('/d/');
  const isMinimal = variant === 'minimal';

  const isWin98 = resolvedTheme === 'win98';

  return (
    <header className={`h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0 ${
      isMinimal
        ? 'bg-transparent'
        : isWin98
          ? 'border-b-2 border-b-[var(--win98-button-highlight)] bg-[var(--win98-button-face)] text-black text-[11px]'
          : 'border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
    }`}>
      <Link href="/" className="font-logo font-semibold text-xl text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
        <DocTalkLogo size={26} />
        {t('app.title')}
      </Link>
      {!isMinimal && documentName && (
        <>
          <span className="mx-3 text-zinc-300 dark:text-zinc-600">/</span>
          <SessionDropdown />
        </>
      )}
      {!isMinimal && !isDocumentPage && lastDocumentId && (
        <Link
          href={`/d/${lastDocumentId}`}
          className="ml-1 sm:ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors max-w-[140px] sm:max-w-[240px] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          title={lastDocumentName || ''}
          aria-label={t('header.backToDocument')}
        >
          <ArrowLeft aria-hidden="true" size={14} className="shrink-0" />
          <span className="max-w-[160px] truncate">{lastDocumentName}</span>
        </Link>
      )}
      {!isMinimal && !isDocumentPage && (
        <Link
          href="/collections"
          className="ml-1 sm:ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          <FolderOpen aria-hidden="true" size={14} className="shrink-0" />
          <span className="hidden sm:inline">{t('collections.title')}</span>
        </Link>
      )}
      <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
        {!isMinimal && !(isDemo && !isLoggedIn) && <ModeSelector />}
        {!isMinimal && <ThemeSelector />}
        {!isMinimal && <div className="hidden sm:block"><CreditsDisplay /></div>}
        <UserMenu />
        <LanguageSelector />
      </div>
    </header>
  );
}
