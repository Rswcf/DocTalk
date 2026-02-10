"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocale } from '../i18n';

const THEMES = [
  { id: 'light', icon: Sun, labelKey: 'header.lightMode' },
  { id: 'dark', icon: Moon, labelKey: 'header.darkMode' },
  { id: 'win98', icon: Monitor, labelKey: 'header.win98Mode' },
] as const;

export default function ThemeSelector() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isWin98 = resolvedTheme === 'win98';

  const updateMenuPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 }); // w-44 = 176px, right-aligned
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
      const idx = THEMES.findIndex((th) => th.id === resolvedTheme);
      setFocusIndex(idx >= 0 ? idx : 0);
    }
  }, [open, resolvedTheme, updateMenuPos]);

  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const choose = (themeId: string) => {
    setTheme(themeId);
    setOpen(false);
  };

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    const itemCount = THEMES.length;
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

  const current = THEMES.find((th) => th.id === resolvedTheme) || THEMES[0];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors ${
          isWin98
            ? 'win98-button'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select theme"
        title={t(current.labelKey)}
      >
        <CurrentIcon aria-hidden="true" size={isWin98 ? 14 : 18} />
        <ChevronDown aria-hidden="true" size={isWin98 ? 10 : 14} className="opacity-70" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-44 bg-white border border-zinc-300 rounded-md shadow-lg z-[9999] p-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onKeyDown={handleMenuKeyDown}
          role="listbox"
        >
          {THEMES.map((theme, i) => {
            const isSelected = resolvedTheme === theme.id;
            const Icon = theme.icon;
            return (
              <button
                key={theme.id}
                ref={(el) => { itemRefs.current[i] = el; }}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${
                  isSelected ? 'font-medium' : ''
                }`}
                onClick={() => choose(theme.id)}
                tabIndex={focusIndex === i ? 0 : -1}
                role="option"
                aria-selected={isSelected}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  {isSelected ? <Check size={14} /> : null}
                </span>
                <Icon aria-hidden="true" size={16} />
                <span className="flex-1">{t(theme.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
