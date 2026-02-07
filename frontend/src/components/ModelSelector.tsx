"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Cpu } from 'lucide-react';
import { AVAILABLE_MODELS, type ModelOption } from '../lib/models';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';

const tierStyles: Record<ModelOption['tier'], { bg: string; hover: string; badge: string | null; badgeClass: string }> = {
  budget: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
    badge: '$',
    badgeClass: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/40',
  },
  standard: {
    bg: '',
    hover: 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
    badge: null,
    badgeClass: '',
  },
  premium: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30',
    badge: 'Pro',
    badgeClass: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/40',
  },
};

export default function ModelSelector() {
  const selectedModel = useDocTalkStore((s) => s.selectedModel);
  const setSelectedModel = useDocTalkStore((s) => s.setSelectedModel);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);
  const { t } = useLocale();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const current = useMemo(() => AVAILABLE_MODELS.find((m) => m.id === selectedModel), [selectedModel]);

  // Group models by tier for separator rendering
  const tierGroups = useMemo(() => {
    const groups: { tier: ModelOption['tier']; models: ModelOption[] }[] = [];
    let currentTier: ModelOption['tier'] | null = null;
    for (const m of AVAILABLE_MODELS) {
      if (m.tier !== currentTier) {
        currentTier = m.tier;
        groups.push({ tier: m.tier, models: [] });
      }
      groups[groups.length - 1].models.push(m);
    }
    return groups;
  }, []);

  const toggle = () => {
    if (isStreaming) return;
    setOpen((v) => !v);
  };

  const choose = (id: string) => {
    setSelectedModel(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        disabled={isStreaming}
        className={`flex items-center gap-1.5 px-2 py-1 border border-zinc-200 rounded-md text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
          isStreaming ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        title={t('header.model')}
      >
        <Cpu size={16} />
        <span className="hidden sm:inline">{current?.label || selectedModel}</span>
        <ChevronDown size={14} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 max-h-80 overflow-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 p-1">
          {tierGroups.map((group, gi) => (
            <React.Fragment key={group.tier}>
              {gi > 0 && (
                <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
              )}
              {group.models.map((m) => {
                const style = tierStyles[m.tier];
                return (
                  <button
                    key={m.id}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${style.bg} ${style.hover} ${
                      selectedModel === m.id ? 'font-medium' : ''
                    }`}
                    onClick={() => choose(m.id)}
                  >
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      {selectedModel === m.id ? <Check size={14} /> : null}
                    </span>
                    <span className="flex-1 truncate">{m.label}</span>
                    {style.badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${style.badgeClass}`}>
                        {style.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
