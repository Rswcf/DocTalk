"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocale } from '../i18n';
import { useDropdownKeyboard } from '../lib/useDropdownKeyboard';

const THEMES = [
  { id: 'light', icon: Sun, labelKey: 'header.lightMode' },
  { id: 'dark', icon: Moon, labelKey: 'header.darkMode' },
  { id: 'system', icon: Monitor, labelKey: 'header.systemMode' },
] as const;

export default function ThemeSelector() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; maxHeight: number }>({
    top: 0,
    left: 0,
    maxHeight: 220,
  });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const updateMenuPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 176;
    const baseTop = rect.bottom + 8;
    const avoid = document.querySelector('[data-dropdown-avoid-overlap="true"]')?.getBoundingClientRect();
    const top = avoid && baseTop < avoid.bottom + 8 ? avoid.bottom + 8 : baseTop;
    setMenuPos({
      top,
      left: Math.min(Math.max(12, rect.right - menuWidth), window.innerWidth - menuWidth - 12),
      maxHeight: Math.max(160, Math.min(220, window.innerHeight - top - 12)),
    });
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
      const currentId = theme ?? 'system';
      const idx = THEMES.findIndex((th) => th.id === currentId);
      setFocusIndex(idx >= 0 ? idx : 0);
    }
  }, [open, theme, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', updateMenuPos);
    window.addEventListener('scroll', updateMenuPos, true);
    return () => {
      window.removeEventListener('resize', updateMenuPos);
      window.removeEventListener('scroll', updateMenuPos, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const choose = (themeId: string) => {
    setTheme(themeId);
    setOpen(false);
  };

  const handleMenuKeyDown = useDropdownKeyboard(
    THEMES.length,
    focusIndex,
    setFocusIndex,
    (index) => {
      const targetTheme = THEMES[index];
      if (targetTheme) choose(targetTheme.id);
    },
    () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
  );

  // Trigger icon shows the EFFECTIVE theme (what the user sees right now),
  // so when theme="system" we show sun/moon matching the resolved value.
  const triggerId = theme === 'system' || !theme ? (resolvedTheme ?? 'light') : theme;
  const current = THEMES.find((th) => th.id === triggerId) || THEMES[0];
  const CurrentIcon = current.icon;
  const menu = open ? (
    <div
      ref={menuRef}
      className="fixed z-[10000] w-44 rounded-2xl border border-[var(--workbench-border)] bg-[var(--workbench-panel-solid)] p-1.5 text-[var(--workbench-ink)] shadow-2xl shadow-black/15 backdrop-blur-2xl dark:shadow-black/45"
      style={{ top: menuPos.top, left: menuPos.left, maxHeight: menuPos.maxHeight }}
      onKeyDown={handleMenuKeyDown}
      role="listbox"
    >
      {THEMES.map((th, i) => {
        // Selected state keys off the raw preference, so "System" can
        // actually show as selected (resolvedTheme would always resolve
        // to light or dark and never match "system").
        const currentId = theme ?? 'system';
        const isSelected = currentId === th.id;
        const Icon = th.icon;
        return (
          <button
            key={th.id}
            ref={(el) => { itemRefs.current[i] = el; }}
            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--workbench-ink)] transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset dark:hover:bg-white/10 ${
              isSelected ? 'font-medium' : ''
            }`}
            onClick={() => choose(th.id)}
            tabIndex={focusIndex === i ? 0 : -1}
            role="option"
            aria-selected={isSelected}
          >
            <span className="w-4 h-4 flex items-center justify-center">
              {isSelected ? <Check size={14} /> : null}
            </span>
            <Icon aria-hidden="true" size={16} />
            <span className="flex-1">{t(th.labelKey)}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dt-workbench-button inline-flex items-center gap-1.5 rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('header.theme')}
      >
        <CurrentIcon aria-hidden="true" size={18} />
        <ChevronDown aria-hidden="true" size={14} className="opacity-70" />
      </button>
      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}
