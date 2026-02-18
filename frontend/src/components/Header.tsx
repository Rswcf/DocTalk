"use client";

import React from 'react';
import { ArrowLeft, FolderOpen } from 'lucide-react';
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
  const { t } = useLocale();
  const pathname = usePathname();
  const isDocumentPage = pathname?.startsWith('/d/');
  const isMinimal = variant === 'minimal';

  return (
    <header className={`h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0 sticky top-0 z-30 ${
      isMinimal
        ? 'bg-transparent'
        : 'border-b border-zinc-200 dark:border-zinc-800 bg-[var(--page-background)]'
    }`}>
      <Link href="/" className="font-logo font-semibold text-xl text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
        <DocTalkLogo size={26} />
        {t('app.title')}
        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 tracking-wide uppercase">Beta</span>
      </Link>
      {isMinimal && (
        <nav className="hidden sm:flex items-center gap-4 ml-4" aria-label="Main navigation">
          <Link href="/demo" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            {t('footer.demo')}
          </Link>
          <Link href="/billing" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            {t('footer.pricing')}
          </Link>
        </nav>
      )}
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
          <span className="max-w-[120px] sm:max-w-[200px] md:max-w-[300px] truncate">{lastDocumentName}</span>
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
        {!isMinimal && <div className="hidden sm:flex"><ThemeSelector /></div>}
        {!isMinimal && <div className="hidden sm:block"><CreditsDisplay /></div>}
        <UserMenu />
        <div className="hidden sm:flex"><LanguageSelector /></div>
      </div>
    </header>
  );
}
