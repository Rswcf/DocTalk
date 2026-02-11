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
  const modalRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector = 'textarea, button[data-modal-focus="true"]';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      if (!modal) return;
      const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    modal.addEventListener('keydown', handleKeyDown);
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overscroll-contain"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 animate-fade-in motion-reduce:animate-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-instructions-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="custom-instructions-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('instructions.title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400" aria-label="Close">
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
          className="w-full h-40 p-3 border border-zinc-200 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          aria-label="Custom instructions"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-zinc-400">
            {text.length}/{MAX_CHARS} {t('instructions.charLimit')}
          </span>
          {saved && (
            <span className="text-xs text-green-600 dark:text-green-400" aria-live="polite">{t('instructions.saved')}</span>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleClear}
            disabled={saving || !text}
            data-modal-focus="true"
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t('instructions.clear')}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            data-modal-focus="true"
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-modal-focus="true"
            className="px-4 py-2 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {saving ? t('common.loading') : t('instructions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
