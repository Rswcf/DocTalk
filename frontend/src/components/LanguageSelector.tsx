"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { LOCALES } from '../i18n';
import { useLocale } from '../i18n';
import { useTheme } from 'next-themes';

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  const { resolvedTheme } = useTheme();
  const isWin98 = resolvedTheme === 'win98';
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const updateMenuPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      updateMenuPos();
      const idx = LOCALES.findIndex((l) => l.code === locale);
      setFocusIndex(idx >= 0 ? idx : 0);
    }
  }, [open, locale, updateMenuPos]);

  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const toggle = () => setOpen((v) => !v);
  const choose = (code: string) => {
    setLocale(code as any);
    setOpen(false);
  };

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    const itemCount = LOCALES.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((prev) => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((prev) => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Home':
        e.preventDefault();
        setFocusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusIndex(itemCount - 1);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  }

  const current = LOCALES.find((l) => l.code === locale);

  return (
    <div ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
          isWin98
            ? 'win98-button'
            : 'border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900'
        }`}
        title={t('header.language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <Globe aria-hidden="true" size={isWin98 ? 14 : 16} />
        <span className={isWin98 ? '' : 'hidden sm:inline'}>{(current?.code || 'en').toUpperCase()}</span>
        <ChevronDown aria-hidden="true" size={isWin98 ? 10 : 14} className="opacity-70" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-48 bg-white border border-zinc-300 rounded-md shadow-lg z-[9999] p-1 max-h-80 overflow-y-auto"
          style={{ top: menuPos.top, right: menuPos.right }}
          onKeyDown={handleMenuKeyDown}
          role="listbox"
        >
          {LOCALES.map((l, i) => (
            <button
              key={l.code}
              ref={(el) => { itemRefs.current[i] = el; }}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${
                locale === l.code ? 'font-medium' : ''
              }`}
              onClick={() => choose(l.code)}
              tabIndex={focusIndex === i ? 0 : -1}
              role="option"
              aria-selected={locale === l.code}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                {locale === l.code ? <Check size={14} /> : null}
              </span>
              <span className="flex-1">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
