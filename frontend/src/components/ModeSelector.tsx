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
      className={`inline-flex rounded-full border border-zinc-300/90 bg-zinc-200/95 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.12)] dark:border-white/18 dark:bg-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_28px_rgba(0,0,0,0.3)] ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}
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
            className={`relative flex min-w-[4rem] items-center justify-center gap-1 rounded-full px-3 py-1 text-sm transition-colors active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:focus-visible:ring-zinc-300 focus-visible:ring-offset-1 ${
              isSelected
                ? 'bg-white font-semibold text-zinc-950 shadow-[0_3px_12px_rgba(15,23,42,0.16)] dark:bg-zinc-50 dark:text-zinc-950'
                : 'text-zinc-600 hover:bg-white/50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white'
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
