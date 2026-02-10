"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Lock } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { AVAILABLE_MODES, isModeAvailable, type ModeId } from '../lib/models';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { useRouter } from 'next/navigation';

export default function ModeSelector() {
  const selectedMode = useDocTalkStore((s) => s.selectedMode);
  const setSelectedMode = useDocTalkStore((s) => s.setSelectedMode);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);
  const userPlan = useDocTalkStore((s) => s.userPlan);
  const { t } = useLocale();
  const router = useRouter();
  const { status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';
  const { resolvedTheme } = useTheme();
  const isWin98 = resolvedTheme === 'win98';

  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = AVAILABLE_MODES.findIndex((m) => m.id === selectedMode);
      setFocusIndex(idx >= 0 ? idx : 0);
    }
  }, [open, selectedMode]);

  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const choose = (modeId: ModeId) => {
    if (isStreaming) return;
    if (!isModeAvailable(modeId, userPlan)) {
      if (isLoggedIn) {
        router.push('/billing');
      } else {
        router.push('?auth=1', { scroll: false });
      }
      setOpen(false);
      return;
    }
    setSelectedMode(modeId);
    setOpen(false);
  };

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    const itemCount = AVAILABLE_MODES.length;
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

  const currentMode = AVAILABLE_MODES.find((m) => m.id === selectedMode);

  if (isWin98) {
    return (
      <div className={`inline-flex items-center gap-1 text-[11px] ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}>
        <span className="text-[var(--win98-black)] mr-1">Mode:</span>
        {AVAILABLE_MODES.map((mode) => {
          const isSelected = selectedMode === mode.id;
          const available = isModeAvailable(mode.id, userPlan);
          return (
            <label
              key={mode.id}
              title={t(mode.descriptionKey)}
              className={`inline-flex items-center gap-[3px] cursor-default ${!available ? 'text-[var(--win98-dark-gray)]' : 'text-[var(--win98-black)]'}`}
            >
              <input
                type="radio"
                name="win98-mode"
                checked={isSelected}
                onChange={() => choose(mode.id)}
                className="accent-[var(--win98-navy)]"
              />
              <span>{t(mode.labelKey)}</span>
              {!available && <Lock aria-hidden="true" size={9} className="text-[var(--win98-dark-gray)]" />}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !isStreaming && setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 border border-zinc-200 rounded-md text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select mode"
      >
        <span>{currentMode ? t(currentMode.labelKey) : 'Mode'}</span>
        <ChevronDown aria-hidden="true" size={14} className="opacity-70" />
      </button>
      {open && (
        <div
          className="absolute left-0 mt-1 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 p-1"
          onKeyDown={handleMenuKeyDown}
          role="listbox"
        >
          {AVAILABLE_MODES.map((mode, i) => {
            const isSelected = selectedMode === mode.id;
            const available = isModeAvailable(mode.id, userPlan);
            return (
              <button
                key={mode.id}
                ref={(el) => { itemRefs.current[i] = el; }}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${
                  isSelected ? 'font-medium' : ''
                }`}
                onClick={() => choose(mode.id)}
                tabIndex={focusIndex === i ? 0 : -1}
                role="option"
                aria-selected={isSelected}
                title={t(mode.descriptionKey)}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  {isSelected ? <Check size={14} /> : null}
                </span>
                <span className="flex-1">{t(mode.labelKey)}</span>
                {!available && <Lock aria-hidden="true" size={10} className="text-zinc-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
