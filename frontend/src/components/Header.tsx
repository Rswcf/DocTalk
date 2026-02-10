"use client";

import React from 'react';
import { Sun, Moon, Monitor, ArrowLeft, FolderOpen } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDocTalkStore } from '../store';
import ModeSelector from './ModeSelector';
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
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const pathname = usePathname();
  const isDocumentPage = pathname?.startsWith('/d/');
  const isMinimal = variant === 'minimal';

  const isWin98 = theme === 'win98';

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('win98');
    else setTheme('light');
  };

  const themeIcon = theme === 'dark' ? <Moon size={18} /> : isWin98 ? <Monitor size={18} /> : <Sun size={18} />;
  const themeTitle = theme === 'dark' ? t('header.darkMode') : isWin98 ? 'Windows 98' : t('header.lightMode');

  return (
    <header className={`h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0 ${
      isMinimal
        ? 'bg-transparent'
        : isWin98
          ? 'border-b-2 border-b-[var(--win98-button-highlight)] bg-[var(--win98-button-face)] text-black text-[11px]'
          : 'border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
    }`}>
      <Link href="/" className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0">
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
          className="ml-1 sm:ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors max-w-[140px] sm:max-w-[240px]"
          title={lastDocumentName || ''}
          aria-label={t('header.backToDocument')}
        >
          <ArrowLeft size={14} className="shrink-0" />
          <span className="max-w-[160px] truncate">{lastDocumentName}</span>
        </Link>
      )}
      {!isMinimal && !isDocumentPage && (
        <Link
          href="/collections"
          className="ml-1 sm:ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        >
          <FolderOpen size={14} className="shrink-0" />
          <span className="hidden sm:inline">{t('collections.title')}</span>
        </Link>
      )}
      <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
        {!isMinimal && !(isDemo && !isLoggedIn) && <ModeSelector />}
        {!isMinimal && (
          <button
            onClick={cycleTheme}
            className={`p-2 rounded-lg transition-colors ${
              isWin98
                ? 'win98-button'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
            title={themeTitle}
          >
            {themeIcon}
          </button>
        )}
        {!isMinimal && <div className="hidden sm:block"><CreditsDisplay /></div>}
        <UserMenu />
        <LanguageSelector />
      </div>
    </header>
  );
}
