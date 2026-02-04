"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chatStream } from '../../lib/sse';
import { getMessages } from '../../lib/api';
import type { Citation, Message } from '../../types';
import { useDocTalkStore } from '../../store';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';

interface ChatPanelProps {
  sessionId: string;
  onCitationClick: (c: Citation) => void;
}

export default function ChatPanel({ sessionId, onCitationClick }: ChatPanelProps) {
  const { messages, isStreaming, addMessage, updateLastMessage, addCitationToLastMessage, setStreaming } = useDocTalkStore();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch existing messages once session is ready
    (async () => {
      try {
        const data = await getMessages(sessionId);
        for (const m of data.messages) {
          addMessage(m);
        }
      } catch {
        // ignore if history not available
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { id: `m_${Date.now()}_u`, role: 'user', text: input, createdAt: Date.now() };
    addMessage(userMsg);
    const asstMsg: Message = { id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() };
    addMessage(asstMsg);
    setStreaming(true);

    await chatStream(
      sessionId,
      input,
      ({ text }) => updateLastMessage(text || ''),
      (c) => addCitationToLastMessage(c),
      (err) => {
        setStreaming(false);
        const errText = `聊天出错：${err?.message || '网络异常，请稍后重试'}`;
        const errorMsg: Message = {
          id: `m_${Date.now()}_e`,
          role: 'assistant',
          text: errText,
          isError: true,
          createdAt: Date.now(),
        };
        addMessage(errorMsg);
      },
      () => setStreaming(false),
    );
    setInput('');
  };

  return (
    <div className="flex h-full flex-col border-l">
      <div ref={listRef} className="flex-1 overflow-auto p-4">
        {messages.map((m) => (
          <div key={m.id}>
            <MessageBubble message={m} onCitationClick={onCitationClick} />
            {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
              <div className="mt-2 pl-6 space-y-2">
                {m.citations.map((c) => (
                  <CitationCard
                    key={`${m.id}-${c.refIndex}`}
                    refIndex={c.refIndex}
                    textSnippet={c.textSnippet}
                    page={c.page}
                    onClick={() => onCitationClick(c)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ask about this document…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-60"
            disabled={isStreaming}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
