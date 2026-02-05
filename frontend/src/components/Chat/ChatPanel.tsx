"use client";

import React, { useEffect, useRef, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { SendHorizontal } from 'lucide-react';
import { chatStream } from '../../lib/sse';
import type { Citation, Message } from '../../types';
import { useDocTalkStore } from '../../store';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';
import { useLocale } from '../../i18n';
import { PaywallModal } from '../PaywallModal';

/**
 * Error boundary for individual messages to prevent one broken message
 * from crashing the entire chat panel.
 */
interface MessageErrorBoundaryProps {
  children: ReactNode;
  messageId: string;
}

interface MessageErrorBoundaryState {
  hasError: boolean;
}

class MessageErrorBoundary extends Component<MessageErrorBoundaryProps, MessageErrorBoundaryState> {
  constructor(props: MessageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): MessageErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error rendering message ${this.props.messageId}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          Failed to render message
        </div>
      );
    }
    return this.props.children;
  }
}

/** 将 citations 按出现顺序重编号为连续的 1, 2, 3, ... */
function renumberCitations(citations: Citation[]): Citation[] {
  if (!citations || citations.length === 0) return [];
  // 按 refIndex 去重，保留首次出现
  const unique = citations.filter(
    (c, i, arr) => arr.findIndex((x) => x.refIndex === c.refIndex) === i
  );
  // 按 offset 排序（文本中出现顺序）
  const sorted = [...unique].sort((a, b) => a.offset - b.offset);
  // 建立映射: oldRefIndex → newSequentialIndex
  const refMap = new Map<number, number>();
  sorted.forEach((c, i) => refMap.set(c.refIndex, i + 1));
  // 应用新编号到所有 citations（含重复引用）
  return citations.map((c) => ({
    ...c,
    refIndex: refMap.get(c.refIndex) ?? c.refIndex,
  }));
}

interface ChatPanelProps {
  sessionId: string;
  onCitationClick: (c: Citation) => void;
}

const SUGGESTED_KEYS = ['chat.suggestedQ1', 'chat.suggestedQ2', 'chat.suggestedQ3', 'chat.suggestedQ4'] as const;

export default function ChatPanel({ sessionId, onCitationClick }: ChatPanelProps) {
  const { messages, isStreaming, addMessage, updateLastMessage, addCitationToLastMessage, setStreaming, updateSessionActivity } = useDocTalkStore();
  const selectedModel = useDocTalkStore((s) => s.selectedModel);
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Message history is loaded in page.tsx

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { id: `m_${Date.now()}_u`, role: 'user', text, createdAt: Date.now() };
    addMessage(userMsg);
    const asstMsg: Message = { id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() };
    addMessage(asstMsg);
    setStreaming(true);

    await chatStream(
      sessionId,
      text,
      ({ text: t }) => updateLastMessage(t || ''),
      (c) => addCitationToLastMessage(c),
      (err) => {
        setStreaming(false);
        // Detect insufficient credits (HTTP 402) and show paywall modal
        const isPaymentRequired = typeof err?.message === 'string' && err.message.includes('HTTP 402');
        if (isPaymentRequired) {
          setShowPaywall(true);
        }
        const errText = `${t('chat.error')}${err?.message || t('chat.networkError')}`;
        const errorMsg: Message = {
          id: `m_${Date.now()}_e`,
          role: 'assistant',
          text: errText,
          isError: true,
          createdAt: Date.now(),
        };
        addMessage(errorMsg);
      },
      () => { setStreaming(false); updateSessionActivity(sessionId); },
      selectedModel,
    );
    setInput('');
  }, [isStreaming, sessionId, addMessage, updateLastMessage, addCitationToLastMessage, setStreaming, selectedModel, t, updateSessionActivity]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestedClick = (q: string) => {
    setInput(q);
    sendMessage(q);
  };

  return (
    <div className="flex h-full flex-col border-r dark:border-gray-700">
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      <div ref={listRef} className="flex-1 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('chat.trySuggested')}</p>
            {SUGGESTED_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleSuggestedClick(t(k))}
                className="w-full text-left text-sm px-4 py-2.5 border rounded-xl hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                {t(k)}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m) => {
            const displayCitations = (m.role === 'assistant' && m.citations && m.citations.length > 0)
              ? renumberCitations(m.citations)
              : undefined;
            const displayMessage = displayCitations ? { ...m, citations: displayCitations } : m;

            return (
              <MessageErrorBoundary key={m.id} messageId={m.id}>
                <div>
                  <MessageBubble message={displayMessage} onCitationClick={onCitationClick} />
                  {displayCitations && displayCitations.length > 0 && (() => {
                    const uniqueCitations = displayCitations
                      .filter((c, i, arr) => arr.findIndex((x) => x.refIndex === c.refIndex) === i)
                      .sort((a, b) => a.refIndex - b.refIndex);
                    return (
                    <div className="mt-2 pl-6 space-y-2">
                      {uniqueCitations.map((c) => (
                        <CitationCard
                          key={`${m.id}-${c.refIndex}`}
                          refIndex={c.refIndex}
                          textSnippet={c.textSnippet}
                          page={c.page}
                          onClick={() => onCitationClick(c)}
                        />
                      ))}
                    </div>
                    );
                  })()}
                </div>
              </MessageErrorBoundary>
            );
          })
        )}
      </div>
      <form onSubmit={onSubmit} className="p-3 border-t dark:border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            style={{ minHeight: '40px', maxHeight: '160px' }}
            placeholder={t('chat.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isStreaming}
            rows={1}
          />
          <button
            type="submit"
            className="p-2 bg-blue-600 text-white rounded-xl disabled:opacity-60 hover:bg-blue-700 transition-colors shrink-0"
            disabled={isStreaming || !input.trim()}
            title={t('chat.send')}
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
