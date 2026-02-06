"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Cpu } from 'lucide-react';
import { AVAILABLE_MODELS } from '../lib/models';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';

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

  const groups = useMemo(() => {
    const map = new Map<string, typeof AVAILABLE_MODELS>();
    for (const m of AVAILABLE_MODELS) {
      const arr = map.get(m.provider) || ([] as any);
      arr.push(m);
      map.set(m.provider, arr);
    }
    return Array.from(map.entries());
  }, []);

  const current = useMemo(() => AVAILABLE_MODELS.find((m) => m.id === selectedModel), [selectedModel]);

  const toggle = () => {
    if (isStreaming) return; // disabled while streaming
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
        <div className="absolute right-0 mt-1 w-64 max-h-72 overflow-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 p-1">
          {groups.map(([provider, models]) => (
            <div key={provider} className="py-1">
              <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{provider}</div>
              {(models as any).map((m: any) => (
                <button
                  key={m.id}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm transition-colors ${
                    selectedModel === m.id ? 'font-medium' : ''
                  }`}
                  onClick={() => choose(m.id)}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {selectedModel === m.id ? <Check size={14} /> : null}
                  </span>
                  <span className="flex-1">{m.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
