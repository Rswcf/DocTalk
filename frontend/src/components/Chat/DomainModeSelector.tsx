"use client";

import React from 'react';
import { GraduationCap, Lock, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDocTalkStore } from '../../store';
import { billingHref } from '../../lib/billingLinks';
import { trackEvent } from '../../lib/analytics';
import { useLocale } from '../../i18n';

interface Props {
  userPlan?: string;
}

const MODES = [
  { id: null, label: 'Default', icon: null, color: '' },
  { id: 'legal' as const, label: 'Legal', icon: Scale, color: 'amber' },
  { id: 'academic' as const, label: 'Academic', icon: GraduationCap, color: 'blue' },
];

export default function DomainModeSelector({ userPlan }: Props) {
  const domainMode = useDocTalkStore((s) => s.domainMode);
  const setDomainMode = useDocTalkStore((s) => s.setDomainMode);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);
  const router = useRouter();
  const { tOr } = useLocale();
  const canUse = userPlan === 'plus' || userPlan === 'pro';

  const chooseMode = (modeId: 'legal' | 'academic' | null) => {
    if (isStreaming) return;

    if (modeId !== null && !canUse) {
      trackEvent('upgrade_click', {
        plan: 'plus',
        period: 'monthly',
        source: 'domain_mode_selector',
        reason: `${modeId}_domain_mode`,
      });
      router.push(billingHref({ plan: 'plus', source: 'domain_mode_selector', reason: `${modeId}_domain_mode` }));
      return;
    }

    setDomainMode(modeId);
  };

  return (
    <div
      role="radiogroup"
      aria-label={tOr('domainModes.ariaLabel', 'Domain mode')}
      className="flex gap-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-1 shadow-sm"
    >
      {MODES.map((m) => {
        const active = domainMode === m.id;
        const locked = !canUse && m.id !== null;
        const disabled = isStreaming;
        const Icon = m.icon;

        return (
          <button
            type="button"
            key={m.id ?? 'default'}
            role="radio"
            aria-checked={active}
            onClick={() => chooseMode(m.id)}
            disabled={disabled}
            title={locked ? tOr('domainModes.upgradeTooltip', 'Upgrade to Plus to unlock') : m.label}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
              active
                ? m.id === 'legal'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : m.id === 'academic'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-zinc-400 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                : locked
                  ? 'border-transparent text-zinc-500 hover:bg-[var(--reader-panel-muted)] hover:text-zinc-700 dark:hover:text-zinc-200'
                  : 'border-transparent text-zinc-500 hover:bg-[var(--reader-panel-muted)]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {locked ? <Lock aria-hidden="true" size={10} /> : Icon && <Icon aria-hidden="true" size={10} />}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
