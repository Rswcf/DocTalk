"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { createSession, getMessages, deleteSession } from '../lib/api';

export default function SessionDropdown() {
  const documentName = useDocTalkStore((s) => s.documentName);
  const documentId = useDocTalkStore((s) => s.documentId);
  const sessionId = useDocTalkStore((s) => s.sessionId);
  const sessions = useDocTalkStore((s) => s.sessions);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);

  const { addSession, setSessionId, setMessages, removeSession, reset } = useDocTalkStore();
  const { t } = useLocale();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setFocusIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const toggle = () => setOpen((v) => !v);

  const onNewChat = async () => {
    if (!documentId || isStreaming) return;
    const s = await createSession(documentId);
    addSession({
      session_id: s.session_id,
      title: null,
      message_count: 0,
      created_at: s.created_at,
      last_activity_at: s.created_at,
    });
    setSessionId(s.session_id);
    setMessages([]);
    setOpen(false);
  };

  const onSwitchSession = async (id: string) => {
    if (isStreaming) return;
    setMessages([]);
    setSessionId(id);
    const msgs = await getMessages(id);
    setMessages(msgs.messages);
    setOpen(false);
  };

  const onDeleteCurrent = async () => {
    if (!sessionId || isStreaming) return;
    if (!window.confirm(t('session.deleteChatConfirm'))) return;
    await deleteSession(sessionId);
    removeSession(sessionId);
    const remaining = useDocTalkStore.getState().sessions;
    if (remaining.length > 0) {
      await onSwitchSession(remaining[0].session_id);
    } else {
      await onNewChat();
    }
    setOpen(false);
  };

  const onBackHome = () => {
    router.push('/');
    reset();
  };

  const disabledClass = isStreaming ? 'opacity-60 cursor-not-allowed' : '';

  const titleText = documentName || '';
  const sortedSessions = useMemo(() => sessions.slice(0, 10), [sessions]);

  // Total items: 1 (New Chat) + sessions + 1 (Delete) + 1 (Back Home)
  const totalItems = 1 + sortedSessions.length + 2;

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Home':
        e.preventDefault();
        setFocusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusIndex(totalItems - 1);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors truncate max-w-[140px] sm:max-w-[300px] flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
        title={titleText}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{titleText}</span>
        <ChevronDown aria-hidden="true" size={14} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 p-1" onKeyDown={handleMenuKeyDown} role="menu">
          <div className="py-1">
            <button
              ref={(el) => { itemRefs.current[0] = el; }}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${disabledClass}`}
              onClick={onNewChat}
              disabled={isStreaming}
              tabIndex={focusIndex === 0 ? 0 : -1}
              role="menuitem"
            >
              <Plus aria-hidden="true" size={16} />
              <span>{t('session.newChat')}</span>
            </button>
          </div>
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t('session.recentChats')}
          </div>
          <div className="max-h-64 overflow-auto">
            {sortedSessions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">{t('session.noTitle')}</div>
            ) : (
              sortedSessions.map((s, i) => {
                const isCurrent = s.session_id === sessionId;
                const label = s.title?.trim() || t('session.noTitle');
                const idx = 1 + i;
                return (
                  <button
                    key={s.session_id}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${
                      isCurrent ? 'font-medium' : ''
                    } ${disabledClass}`}
                    onClick={() => onSwitchSession(s.session_id)}
                    disabled={isStreaming}
                    tabIndex={focusIndex === idx ? 0 : -1}
                    role="menuitem"
                  >
                    <span className="w-4 h-4 flex items-center justify-center">
                      {isCurrent ? <span className="block w-2 h-2 rounded-full bg-zinc-600" aria-label="Current session" /> : null}
                    </span>
                    <span className="flex-1 truncate" title={label}>{label}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('session.messageCount', { count: s.message_count })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="py-1">
            <button
              ref={(el) => { itemRefs.current[1 + sortedSessions.length] = el; }}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-red-600 dark:text-red-400 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${disabledClass}`}
              onClick={onDeleteCurrent}
              disabled={isStreaming}
              tabIndex={focusIndex === 1 + sortedSessions.length ? 0 : -1}
              role="menuitem"
            >
              <Trash2 aria-hidden="true" size={16} />
              <span>{t('session.deleteChat')}</span>
            </button>
            <button
              ref={(el) => { itemRefs.current[2 + sortedSessions.length] = el; }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
              onClick={onBackHome}
              tabIndex={focusIndex === 2 + sortedSessions.length ? 0 : -1}
              role="menuitem"
            >
              <Home aria-hidden="true" size={16} />
              <span>{t('session.backHome')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
