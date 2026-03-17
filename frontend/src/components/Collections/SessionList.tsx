"use client";

import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import type { SessionItem } from '../../types';

interface SessionListProps {
  sessions: SessionItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export default function SessionList({ sessions, activeSessionId, onSelectSession, onNewSession }: SessionListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Sessions ({sessions.length})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => onSelectSession(s.session_id)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg ${
              s.session_id === activeSessionId
                ? 'bg-zinc-200 dark:bg-zinc-700'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <MessageSquare size={14} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
              {s.title || `Chat (${s.message_count} msgs)`}
            </span>
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4">No sessions yet</p>
        )}
      </div>
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
        >
          <Plus size={12} /> New Chat
        </button>
      </div>
    </div>
  );
}
