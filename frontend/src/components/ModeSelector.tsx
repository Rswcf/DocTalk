"use client";

import React from 'react';
import { Lock } from 'lucide-react';
import { AVAILABLE_MODES, isModeAvailable, type ModeId } from '../lib/models';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { useRouter } from 'next/navigation';
import { billingHref } from '../lib/billingLinks';
import { trackEvent } from '../lib/analytics';

export default function ModeSelector() {
  const selectedMode = useDocTalkStore((s) => s.selectedMode);
  const setSelectedMode = useDocTalkStore((s) => s.setSelectedMode);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);
  const userPlan = useDocTalkStore((s) => s.userPlan);
  const { t } = useLocale();
  const router = useRouter();

  const choose = (modeId: ModeId) => {
    if (isStreaming) return;
    if (!isModeAvailable(modeId, userPlan)) {
      trackEvent('upgrade_click', { plan: 'plus', period: 'monthly', source: 'mode_selector', reason: `${modeId}_mode` });
      router.push(billingHref({ plan: 'plus', source: 'mode_selector', reason: `${modeId}_mode` }));
      return;
    }
    setSelectedMode(modeId);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('modes.ariaLabel')}
      data-tour="mode-selector"
      className={`inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 p-0.5 ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {AVAILABLE_MODES.map((mode) => {
        const isSelected = selectedMode === mode.id;
        const available = isModeAvailable(mode.id, userPlan);
        return (
          <button
            key={mode.id}
            role="radio"
            aria-checked={isSelected}
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
