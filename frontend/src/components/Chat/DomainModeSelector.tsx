"use client";

import React from 'react';
import { GraduationCap, Lock, Scale } from 'lucide-react';
import { useDocTalkStore } from '../../store';

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
  const canUse = userPlan === 'plus' || userPlan === 'pro';

  return (
    <div className="flex gap-1">
      {MODES.map((m) => {
        const active = domainMode === m.id;
        const disabled = !canUse && m.id !== null;
        const Icon = m.icon;

        return (
          <button
            type="button"
            key={m.id ?? 'default'}
            onClick={() => !disabled && !isStreaming && setDomainMode(m.id)}
            disabled={disabled || isStreaming}
            title={disabled ? 'Upgrade to Plus to unlock' : m.label}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
              active
                ? m.id === 'legal'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : m.id === 'academic'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-zinc-400 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {disabled && <Lock size={10} />}
            {Icon && !disabled && <Icon size={10} />}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
