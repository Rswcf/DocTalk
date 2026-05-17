"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { LOCALES } from '../i18n';
import { useLocale } from '../i18n';
import { useDropdownKeyboard } from '../lib/useDropdownKeyboard';

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; maxHeight: number }>({
    top: 0,
    right: 0,
    maxHeight: 320,
  });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const updateMenuPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const baseTop = rect.bottom + 8;
    const avoid = document.querySelector('[data-dropdown-avoid-overlap="true"]')?.getBoundingClientRect();
    const top = avoid && baseTop < avoid.bottom + 8 ? avoid.bottom + 8 : baseTop;
    setMenuPos({
      top,
      right: Math.max(12, window.innerWidth - rect.right),
      maxHeight: Math.max(160, Math.min(320, window.innerHeight - top - 12)),
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
      const idx = LOCALES.findIndex((l) => l.code === locale);
      setFocusIndex(idx >= 0 ? idx : 0);
    }
  }, [open, locale, updateMenuPos]);

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

  const toggle = () => setOpen((v) => !v);
  const choose = (code: string) => {
    setLocale(code as any);
    setOpen(false);
  };

  const handleMenuKeyDown = useDropdownKeyboard(
    LOCALES.length,
    focusIndex,
    setFocusIndex,
    (index) => {
      const targetLocale = LOCALES[index];
      if (targetLocale) choose(targetLocale.code);
    },
    () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
  );

  const current = LOCALES.find((l) => l.code === locale);
  const menu = open ? (
    <div
      ref={menuRef}
      className="fixed z-[10000] w-56 overflow-y-auto rounded-2xl border border-[var(--workbench-border)] bg-[var(--workbench-panel-solid)] p-1.5 text-[var(--workbench-ink)] shadow-2xl shadow-black/15 backdrop-blur-2xl dark:shadow-black/45"
      style={{ top: menuPos.top, right: menuPos.right, maxHeight: menuPos.maxHeight }}
      onKeyDown={handleMenuKeyDown}
      role="listbox"
    >
      {LOCALES.map((l, i) => (
        <button
          key={l.code}
          ref={(el) => { itemRefs.current[i] = el; }}
          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--workbench-ink)] transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset dark:hover:bg-white/10 ${
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
  ) : null;

  return (
    <div ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="dt-workbench-button inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${(current?.code || 'en').toUpperCase()} ${t('header.language')}`}
      >
        <Globe aria-hidden="true" size={16} />
        <span className="hidden sm:inline">{(current?.code || 'en').toUpperCase()}</span>
        <ChevronDown aria-hidden="true" size={14} className="opacity-70" />
      </button>
      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}
