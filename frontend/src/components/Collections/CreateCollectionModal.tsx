"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '../../i18n';
import { getMyDocuments, createCollection } from '../../lib/api';
import type { DocumentBrief } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function CreateCollectionModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [docs, setDocs] = useState<DocumentBrief[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedDocs(new Set());
      getMyDocuments().then(setDocs).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await createCollection(name.trim(), description.trim() || undefined, Array.from(selectedDocs));
      onCreated(result.id);
      onClose();
    } catch {
      // error handling
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overscroll-contain"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 animate-fade-in motion-reduce:animate-none max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="create-collection-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('collections.create')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('collections.name')}
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('collections.namePlaceholder')}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              maxLength={200}
              aria-label="Collection name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('collections.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-20 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              aria-label="Collection description"
              maxLength={2000}
            />
          </div>

          {docs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t('collections.addDocuments')}
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {docs.filter(d => d.status === 'ready').map(d => (
                  <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(d.id)}
                      onChange={() => toggleDoc(d.id)}
                      className="rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{d.filename}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            {creating ? t('common.loading') : t('collections.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
