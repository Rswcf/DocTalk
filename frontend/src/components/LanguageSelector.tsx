"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { LOCALES } from '../i18n';
import { useLocale } from '../i18n';

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggle = () => setOpen((v) => !v);
  const choose = (code: string) => {
    setLocale(code as any);
    setOpen(false);
  };

  const current = LOCALES.find((l) => l.code === locale);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 px-2 py-1 border border-zinc-200 rounded-md text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title={t('header.language')}
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{(current?.code || 'en').toUpperCase()}</span>
        <ChevronDown size={14} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 p-1">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm transition-colors ${
                locale === l.code ? 'font-medium' : ''
              }`}
              onClick={() => choose(l.code)}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                {locale === l.code ? <Check size={14} /> : null}
              </span>
              <span className="text-lg leading-none">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
