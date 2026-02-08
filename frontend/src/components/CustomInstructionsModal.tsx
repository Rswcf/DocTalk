"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentInstructions: string | null;
  onSave: (instructions: string | null) => Promise<void>;
}

export default function CustomInstructionsModal({ isOpen, onClose, currentInstructions, onSave }: Props) {
  const [text, setText] = useState(currentInstructions || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLocale();
  const MAX_CHARS = 2000;

  useEffect(() => {
    setText(currentInstructions || '');
    setSaved(false);
  }, [currentInstructions, isOpen]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(text.trim() || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onSave(null);
      setText('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('instructions.title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
          {t('instructions.description')}
        </p>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder={t('instructions.placeholder')}
          className="w-full h-40 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-zinc-400">
            {text.length}/{MAX_CHARS} {t('instructions.charLimit')}
          </span>
          {saved && (
            <span className="text-xs text-green-600 dark:text-green-400">{t('instructions.saved')}</span>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleClear}
            disabled={saving || !text}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {t('instructions.clear')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('instructions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
