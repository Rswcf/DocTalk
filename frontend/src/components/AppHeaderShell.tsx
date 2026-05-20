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
import FeedbackButton from './FeedbackButton';

interface AppHeaderShellProps {
  isDemo?: boolean;
  isLoggedIn?: boolean;
}

export default function AppHeaderShell({ isDemo, isLoggedIn }: AppHeaderShellProps) {
  const documentName = useDocTalkStore((s) => s.documentName);
  const lastDocumentId = useDocTalkStore((s) => s.lastDocumentId);
  const lastDocumentName = useDocTalkStore((s) => s.lastDocumentName);
  const { t } = useLocale();
  const pathname = usePathname();
  const isDocumentPage = pathname?.startsWith('/d/');

  return (
    <header className="dt-shell-header h-14 flex items-center px-3 sm:px-6 gap-2 sm:gap-3 min-w-0 shrink-0 sticky top-0 z-30 border-b">
      <Link href="/" className="font-logo font-semibold text-lg sm:text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-1.5 sm:gap-2">
        <DocTalkLogo size={26} />
        {t('app.title')}
        <span className="hidden sm:inline ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-white/18 bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
      </Link>
      {documentName && (
        <>
          <span className="mx-1 sm:mx-3 text-white/25">/</span>
          <SessionDropdown />
        </>
      )}
      {!isDocumentPage && lastDocumentId && (
        <Link
          href={`/d/${lastDocumentId}`}
          className="dt-workbench-pill ml-1 sm:ml-3 inline-flex max-w-[140px] items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors hover:border-[var(--workbench-border-strong)] sm:max-w-[240px] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          title={lastDocumentName || ''}
          aria-label={t('header.backToDocument')}
        >
          <ArrowLeft aria-hidden="true" size={14} className="shrink-0" />
          <span className="max-w-[120px] sm:max-w-[200px] md:max-w-[300px] truncate">{lastDocumentName}</span>
        </Link>
      )}
      {!isDocumentPage && (
        <Link
          href="/collections"
          className="dt-workbench-pill ml-1 sm:ml-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors hover:border-[var(--workbench-border-strong)] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          <FolderOpen aria-hidden="true" size={14} className="shrink-0" />
          <span className="hidden sm:inline">{t('collections.title')}</span>
        </Link>
      )}
      <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
        {!(isDemo && !isLoggedIn) && <ModeSelector />}
        <div className="hidden sm:flex"><ThemeSelector /></div>
        {!(isDemo && !isLoggedIn) && <FeedbackButton />}
        <div className="hidden sm:block"><CreditsDisplay /></div>
        <UserMenu />
        <div className="hidden sm:flex"><LanguageSelector /></div>
      </div>
    </header>
  );
}
