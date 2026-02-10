"use client";

import React from 'react';
import { Lock } from 'lucide-react';
import { useSession } from 'next-auth/react';
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

  return (
    <div className={`inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}>
      {AVAILABLE_MODES.map((mode) => {
        const isSelected = selectedMode === mode.id;
        const available = isModeAvailable(mode.id, userPlan);
        return (
          <button
            key={mode.id}
            onClick={() => choose(mode.id)}
            title={t(mode.descriptionKey)}
            className={`relative flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
              isSelected
                ? 'bg-white dark:bg-zinc-700 shadow-sm font-medium text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>{t(mode.labelKey)}</span>
            {!available && <Lock size={10} className="text-zinc-400" />}
          </button>
        );
      })}
    </div>
  );
}
