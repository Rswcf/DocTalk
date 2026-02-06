"use client";

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useDocTalkStore } from '../store';
import ModelSelector from './ModelSelector';
import LanguageSelector from './LanguageSelector';
import UserMenu from './UserMenu';
import { useLocale } from '../i18n';
import SessionDropdown from './SessionDropdown';
import { CreditsDisplay } from './CreditsDisplay';

export default function Header() {
  const documentName = useDocTalkStore((s) => s.documentName);
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-12 flex items-center px-4 border-b bg-white dark:bg-gray-900 dark:border-gray-700 shrink-0">
      <div className="font-semibold text-lg dark:text-gray-100">{t('app.title')}</div>
      {documentName && (
        <>
          <span className="mx-3 text-gray-300 dark:text-gray-600">/</span>
          <SessionDropdown />
        </>
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
