"use client";

import React from 'react';
import { Sun, Moon, ArrowLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDocTalkStore } from '../store';
import ModelSelector from './ModelSelector';
import LanguageSelector from './LanguageSelector';
import UserMenu from './UserMenu';
import { useLocale } from '../i18n';
import SessionDropdown from './SessionDropdown';
import { CreditsDisplay } from './CreditsDisplay';

export default function Header() {
  const documentName = useDocTalkStore((s) => s.documentName);
  const lastDocumentId = useDocTalkStore((s) => s.lastDocumentId);
  const lastDocumentName = useDocTalkStore((s) => s.lastDocumentName);
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const pathname = usePathname();
  const isDocumentPage = pathname?.startsWith('/d/');

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-12 flex items-center px-4 border-b bg-white dark:bg-gray-900 dark:border-gray-700 shrink-0">
      <Link href="/" className="font-semibold text-lg dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        {t('app.title')}
      </Link>
      {documentName && (
        <>
          <span className="mx-3 text-gray-300 dark:text-gray-600">/</span>
          <SessionDropdown />
        </>
      )}
      {!isDocumentPage && lastDocumentId && (
        <Link
          href={`/d/${lastDocumentId}`}
          className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
          title={lastDocumentName || ''}
          aria-label={t('header.backToDocument')}
        >
          <ArrowLeft size={14} className="shrink-0" />
          <span className="max-w-[160px] truncate">{lastDocumentName}</span>
        </Link>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ModelSelector />
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          title={theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <CreditsDisplay />
        <UserMenu />
        <LanguageSelector />
      </div>
    </header>
  );
}
