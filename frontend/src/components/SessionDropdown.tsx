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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[300px] flex items-center gap-1.5"
        title={titleText}
      >
        <span className="truncate">{titleText}</span>
        <ChevronDown size={14} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-72 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-md shadow-lg z-20 p-1">
          <div className="py-1">
            <button
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm ${disabledClass}`}
              onClick={onNewChat}
              disabled={isStreaming}
            >
              <Plus size={16} />
              <span>{t('session.newChat')}</span>
            </button>
          </div>
          <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('session.recentChats')}
          </div>
          <div className="max-h-64 overflow-auto">
            {sortedSessions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('session.noTitle')}</div>
            ) : (
              sortedSessions.map((s) => {
                const isCurrent = s.session_id === sessionId;
                const label = s.title?.trim() || t('session.noTitle');
                return (
                  <button
                    key={s.session_id}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm ${
                      isCurrent ? 'font-medium' : ''
                    } ${disabledClass}`}
                    onClick={() => onSwitchSession(s.session_id)}
                    disabled={isStreaming}
                  >
                    <span className="w-4 h-4 flex items-center justify-center">
                      {isCurrent ? <span className="block w-2 h-2 rounded-full bg-blue-600" /> : null}
                    </span>
                    <span className="flex-1 truncate" title={label}>{label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('session.messageCount', { count: s.message_count })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
          <div className="py-1">
            <button
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-red-600 dark:text-red-400 ${disabledClass}`}
              onClick={onDeleteCurrent}
              disabled={isStreaming}
            >
              <Trash2 size={16} />
              <span>{t('session.deleteChat')}</span>
            </button>
            <button
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
              onClick={onBackHome}
            >
              <Home size={16} />
              <span>{t('session.backHome')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
