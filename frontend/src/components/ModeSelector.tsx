"use client";

import React from 'react';
import { Lock } from 'lucide-react';
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

  const choose = (modeId: ModeId) => {
    if (isStreaming) return;
    if (!isModeAvailable(modeId, userPlan)) {
      if (isLoggedIn) {
        router.push('/billing');
      } else {
        router.push('?auth=1', { scroll: false });
      }
      return;
    }
    setSelectedMode(modeId);
  };

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
    <div className={`inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 p-0.5 ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}>
      {AVAILABLE_MODES.map((mode) => {
        const isSelected = selectedMode === mode.id;
        const available = isModeAvailable(mode.id, userPlan);
        return (
          <button
            key={mode.id}
            onClick={() => choose(mode.id)}
            title={t(mode.descriptionKey)}
            className={`relative flex items-center gap-1 px-3 py-1 text-sm rounded-full transition-colors active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-1 ${
              isSelected
                ? 'bg-white dark:bg-zinc-700 shadow-sm font-medium text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <span>{t(mode.labelKey)}</span>
            {!available && <Lock aria-hidden="true" size={10} className="text-zinc-400" />}
          </button>
        );
      })}
    </div>
  );
}
