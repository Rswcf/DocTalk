"use client";

import React, { useEffect, useRef, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SendHorizontal, Download, ArrowDown, Plus, Settings2, Square } from 'lucide-react';
import { chatStream } from '../../lib/sse';
import { exportConversationAsMarkdown } from '../../lib/export';
import type { Citation, Message } from '../../types';
import { useDocTalkStore } from '../../store';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';
import { useLocale } from '../../i18n';
import { PaywallModal } from '../PaywallModal';
import { triggerCreditsRefresh } from '../CreditsDisplay';

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
  maxUserMessages?: number;
  suggestedQuestions?: string[];
  onOpenSettings?: () => void;
  hasCustomInstructions?: boolean;
}

const SUGGESTED_KEYS = ['chat.suggestedQ1', 'chat.suggestedQ2', 'chat.suggestedQ3', 'chat.suggestedQ4'] as const;

export default function ChatPanel({ sessionId, onCitationClick, maxUserMessages, suggestedQuestions, onOpenSettings, hasCustomInstructions }: ChatPanelProps) {
  const { messages, isStreaming, addMessage, updateLastMessage, addCitationToLastMessage, setStreaming, updateSessionActivity } = useDocTalkStore();
  const selectedMode = useDocTalkStore((s) => s.selectedMode);
  const { t, locale } = useLocale();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Phase 1: Plus menu state
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  // Phase 2: Scroll-to-bottom button
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Phase 9b: Abort controller for stop generation
  const abortRef = useRef<AbortController | null>(null);

  // Demo mode: track user message count
  const userMsgCount = maxUserMessages != null
    ? messages.filter((m) => m.role === 'user').length
    : 0;
  const demoRemaining = maxUserMessages != null ? maxUserMessages - userMsgCount : Infinity;
  const demoLimitReached = maxUserMessages != null && demoRemaining <= 0;

  // Message history is loaded in page.tsx

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      setShowScrollBtn(false);
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, Math.max(160, window.innerHeight * 0.4)) + 'px';
    }
  }, [input]);

  // Close plus menu on outside click
  useEffect(() => {
    if (!plusMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-plus-menu]')) {
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [plusMenuOpen]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!atBottom);
  }, []);

  const router = useRouter();

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    // Demo limit check (client-side)
    if (demoLimitReached) {
      router.push('?auth=1', { scroll: false });
      return;
    }
    const userMsg: Message = { id: `m_${Date.now()}_u`, role: 'user', text, createdAt: Date.now() };
    addMessage(userMsg);
    const asstMsg: Message = { id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() };
    addMessage(asstMsg);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await chatStream(
      sessionId,
      text,
      ({ text: t }) => updateLastMessage(t || ''),
      (c) => addCitationToLastMessage(c),
      (err) => {
        setStreaming(false);
        abortRef.current = null;
        // Detect insufficient credits (HTTP 402) and show paywall modal
        const isPaymentRequired = typeof err?.message === 'string' && err.message.includes('HTTP 402');
        if (isPaymentRequired) {
          setShowPaywall(true);
        }
        // Detect document still processing (HTTP 409) — show processing message
        const isProcessing = typeof err?.message === 'string' && err.message.includes('HTTP 409');
        if (isProcessing) {
          const processingMsg: Message = {
            id: `m_${Date.now()}_proc`,
            role: 'assistant',
            text: t('doc.processing'),
            createdAt: Date.now(),
          };
          addMessage(processingMsg);
          return;
        }
        // Detect demo limit or rate limit (HTTP 429)
        const isDemoLimit = typeof err?.message === 'string' && err.message.includes('HTTP 429');
        if (isDemoLimit) {
          const isRateLimit = err.message.includes('Rate limit exceeded');
          const limitMsg: Message = {
            id: `m_${Date.now()}_limit`,
            role: 'assistant',
            text: isRateLimit ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
            createdAt: Date.now(),
          };
          addMessage(limitMsg);
          return;
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
      () => { setStreaming(false); abortRef.current = null; updateSessionActivity(sessionId); triggerCreditsRefresh(); },
      selectedMode,
      locale,
      controller.signal,
    );
    setInput('');
  }, [isStreaming, demoLimitReached, sessionId, addMessage, updateLastMessage, addCitationToLastMessage, setStreaming, selectedMode, locale, t, updateSessionActivity, router]);

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

  const handleExport = useCallback(() => {
    const docName = useDocTalkStore.getState().documentName || 'document';
    exportConversationAsMarkdown(messages, docName);
  }, [messages]);

  const handleRegenerate = useCallback(() => {
    if (isStreaming) return;
    const msgs = useDocTalkStore.getState().messages;
    // Find the last user message
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const lastUserText = msgs[lastUserIdx].text;
    // Remove all messages after (and including) the last user message's response
    const trimmed = msgs.slice(0, lastUserIdx + 1);
    useDocTalkStore.getState().setMessages(trimmed);
    // Re-send the last user message
    // We need to manually trigger the stream without adding the user message again
    const asstMsg: Message = { id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() };
    addMessage(asstMsg);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    chatStream(
      sessionId,
      lastUserText,
      ({ text: t }) => updateLastMessage(t || ''),
      (c) => addCitationToLastMessage(c),
      (err) => {
        setStreaming(false);
        abortRef.current = null;
        const isPaymentRequired = typeof err?.message === 'string' && err.message.includes('HTTP 402');
        if (isPaymentRequired) { setShowPaywall(true); }
      },
      () => { setStreaming(false); abortRef.current = null; updateSessionActivity(sessionId); triggerCreditsRefresh(); },
      selectedMode,
      locale,
      controller.signal,
    );
  }, [isStreaming, sessionId, addMessage, updateLastMessage, addCitationToLastMessage, setStreaming, selectedMode, locale, updateSessionActivity]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, [setStreaming]);

  // Determine which plus menu items to show
  const showCustomInstructions = !!onOpenSettings;
  const showExportInMenu = messages.length > 0 && !isStreaming;
  const showPlusButton = showCustomInstructions || showExportInMenu;

  return (
    <div className="flex h-full flex-col border-r dark:border-zinc-700">
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      <div className="relative flex-1 min-h-0">
        <div ref={listRef} onScroll={handleScroll} className="h-full overflow-auto p-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">{t('chat.trySuggested')}</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {(suggestedQuestions && suggestedQuestions.length > 0
                ? suggestedQuestions.map((q, i) => (
                    <button
                      key={`sq-${i}`}
                      type="button"
                      onClick={() => handleSuggestedClick(q)}
                      className="text-sm px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-zinc-600 dark:text-zinc-400"
                    >
                      {q}
                    </button>
                  ))
                : SUGGESTED_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleSuggestedClick(t(k))}
                      className="text-sm px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-zinc-600 dark:text-zinc-400"
                    >
                      {t(k)}
                    </button>
                  ))
              )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
            {messages.map((m, idx) => {
              const displayCitations = (m.role === 'assistant' && m.citations && m.citations.length > 0)
                ? renumberCitations(m.citations)
                : undefined;
              const displayMessage = displayCitations ? { ...m, citations: displayCitations } : m;
              const isLastMessage = idx === messages.length - 1;
              const showStreaming = isLastMessage && isStreaming && m.role === 'assistant';
              const isLastAssistant = m.role === 'assistant' && !isStreaming && idx === messages.length - 1;

              return (
                <MessageErrorBoundary key={m.id} messageId={m.id}>
                  <div>
                    <MessageBubble message={displayMessage} onCitationClick={onCitationClick} isStreaming={showStreaming} onRegenerate={isLastAssistant ? handleRegenerate : undefined} isLastAssistant={isLastAssistant} />
                    {displayCitations && displayCitations.length > 0 && (() => {
                      const uniqueCitations = displayCitations
                        .filter((c, i, arr) => arr.findIndex((x) => x.refIndex === c.refIndex) === i)
                        .sort((a, b) => a.refIndex - b.refIndex);
                      return (
                      <div className="mt-2 pl-0 flex flex-wrap gap-1.5">
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
            })}
            </div>
          )}
        </div>
        {showScrollBtn && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10">
            <button
              onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}
              className="pointer-events-auto p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md hover:shadow-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-shadow"
            >
              <ArrowDown size={16} />
            </button>
          </div>
        )}
      </div>
      {maxUserMessages != null && (
        <div className="border-t dark:border-zinc-700">
          <div className="h-1 bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full transition-all duration-300 ${
                demoRemaining <= 2 ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
              }`}
              style={{ width: `${Math.max(0, (demoRemaining / maxUserMessages) * 100)}%` }}
            />
          </div>
          <div className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
            <span className={demoRemaining <= 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
              {t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
            </span>
            {!demoLimitReached ? (
              <button type="button" onClick={() => router.push('?auth=1', { scroll: false })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-sm">
                {t('demo.signInForUnlimited')}
              </button>
            ) : (
              <button type="button" onClick={() => router.push('?auth=1', { scroll: false })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-sm font-medium">
                {t('demo.signInToContinue')}
              </button>
            )}
          </div>
        </div>
      )}
      <form onSubmit={onSubmit} className="p-4 border-t dark:border-zinc-700">
        <div className="max-w-3xl mx-auto">
        <div className="flex items-end border border-zinc-200 dark:border-zinc-700 rounded-3xl bg-white dark:bg-zinc-800 shadow-sm focus-within:ring-2 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-500 transition-shadow">
          {showPlusButton && (
            <div className="relative pl-2 pb-2 shrink-0" data-plus-menu>
              <button
                type="button"
                onClick={() => setPlusMenuOpen((v) => !v)}
                className="p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <Plus size={16} />
              </button>
              {plusMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-20 py-1 animate-fade-in">
                  {showCustomInstructions && (
                    <button
                      type="button"
                      onClick={() => { onOpenSettings?.(); setPlusMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Settings2 size={16} />
                      <span>{t('chat.customInstructions') || 'Custom Instructions'}</span>
                      {hasCustomInstructions && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  )}
                  {showCustomInstructions && showExportInMenu && (
                    <div className="border-t border-zinc-100 dark:border-zinc-700" />
                  )}
                  {showExportInMenu && (
                    <button
                      type="button"
                      onClick={() => { handleExport(); setPlusMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Download size={16} />
                      <span>{t('chat.export')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="flex-1 px-4 py-3 text-sm resize-none overflow-y-auto focus:outline-none bg-transparent dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            style={{ minHeight: '40px' }}
            placeholder={demoLimitReached ? t('demo.signInToContinue') : t('chat.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isStreaming || demoLimitReached}
            rows={1}
          />
          <div className="flex items-center gap-1 pr-2 pb-2 shrink-0">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                title={t('chat.stop') || 'Stop'}
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                type="submit"
                className="p-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-full disabled:opacity-40 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                disabled={!input.trim() || demoLimitReached}
                title={t('chat.send')}
              >
                <SendHorizontal size={16} />
              </button>
            )}
          </div>
        </div>
        </div>
      </form>
      <div className="text-center pb-2">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-3xl mx-auto">
          {t('chat.disclaimer')}
        </p>
      </div>
    </div>
  );
}
