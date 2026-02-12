"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SendHorizontal, ArrowDown, Square } from 'lucide-react';
import { exportConversationAsMarkdown } from '../../lib/export';
import type { Citation } from '../../types';
import { useDocTalkStore } from '../../store';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';
import { useLocale } from '../../i18n';
import { PaywallModal } from '../PaywallModal';
import PlusMenu from './PlusMenu';
import MessageErrorBoundary from './MessageErrorBoundary';
import { renumberCitations } from '../../lib/citations';
import { SUGGESTED_KEYS } from '../../lib/constants';
import { useChatStream } from '../../lib/useChatStream';

interface ChatPanelProps {
  sessionId: string;
  onCitationClick: (c: Citation) => void;
  maxUserMessages?: number;
  suggestedQuestions?: string[];
  onOpenSettings?: () => void;
  hasCustomInstructions?: boolean;
  userPlan?: string;
}

export default function ChatPanel({ sessionId, onCitationClick, maxUserMessages, suggestedQuestions, onOpenSettings, hasCustomInstructions, userPlan }: ChatPanelProps) {
  const messages = useDocTalkStore((s) => s.messages);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);
  const selectedMode = useDocTalkStore((s) => s.selectedMode);
  const { t, locale } = useLocale();
  const router = useRouter();

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuButtonRef = useRef<HTMLButtonElement>(null);

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const {
    sendMessage,
    regenerateLastResponse,
    continueGenerating,
    stopStreaming,
    demoRemaining,
    demoLimitReached,
    messagesUsed,
    maxMessages,
  } = useChatStream({
    sessionId,
    selectedMode,
    locale,
    t,
    maxUserMessages,
    onShowPaywall: () => setShowPaywall(true),
    onRequireAuth: () => router.push('?auth=1', { scroll: false }),
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' });
    }

    setShowScrollBtn(!isNearBottom);
  }, [messages, isStreaming]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, Math.max(160, window.innerHeight * 0.4)) + 'px';
    }
  }, [input]);

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

  useEffect(() => {
    if (!plusMenuOpen) return;
    const frame = window.requestAnimationFrame(() => {
      plusMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [plusMenuOpen]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!atBottom);
  }, []);

  const handlePlusMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const menuItems = plusMenuRef.current
      ? Array.from(plusMenuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      : [];
    if (menuItems.length === 0) return;

    const activeIndex = menuItems.findIndex((item) => item === document.activeElement);

    if (e.key === 'Escape') {
      e.preventDefault();
      setPlusMenuOpen(false);
      plusMenuButtonRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % menuItems.length : 0;
      menuItems[nextIndex]?.focus();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = activeIndex >= 0
        ? (activeIndex - 1 + menuItems.length) % menuItems.length
        : menuItems.length - 1;
      menuItems[prevIndex]?.focus();
      return;
    }

    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement instanceof HTMLElement) {
      if (document.activeElement.getAttribute('role') === 'menuitem') {
        e.preventDefault();
        document.activeElement.click();
      }
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sent = await sendMessage(input);
    if (sent) setInput('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input).then((sent) => {
        if (sent) setInput('');
      });
    }
  };

  const handleSuggestedClick = (question: string) => {
    setInput(question);
    void sendMessage(question).then((sent) => {
      if (sent) setInput('');
    });
  };

  const handleExport = useCallback(() => {
    const docName = useDocTalkStore.getState().documentName || 'document';
    exportConversationAsMarkdown(messages, docName);
  }, [messages]);

  const canUseCustomInstructions = !!onOpenSettings;
  const showCustomInstructions = canUseCustomInstructions || userPlan === 'free';
  const canUseExport = messages.length > 0 && !isStreaming && (userPlan === 'plus' || userPlan === 'pro');
  const showExportInMenu = messages.length > 0 && !isStreaming && (canUseExport || userPlan === 'free');

  const displayedSuggestedQuestions = suggestedQuestions && suggestedQuestions.length > 0
    ? suggestedQuestions
    : SUGGESTED_KEYS.map((key) => t(key));

  return (
    <div className="flex h-full flex-col border-r dark:border-zinc-700">
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          data-tour="chat-area"
          className="h-full overflow-y-auto overflow-x-hidden p-6"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">{t('chat.trySuggested')}</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {displayedSuggestedQuestions.map((question, index) => (
                  <button
                    key={`sq-${index}`}
                    type="button"
                    onClick={() => handleSuggestedClick(question)}
                    className="text-sm px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-zinc-600 dark:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((message, idx) => {
                const displayCitations = (message.role === 'assistant' && message.citations && message.citations.length > 0)
                  ? renumberCitations(message.citations)
                  : undefined;
                const displayMessage = displayCitations ? { ...message, citations: displayCitations } : message;
                const isLastMessage = idx === messages.length - 1;
                const showStreaming = isLastMessage && isStreaming && message.role === 'assistant';
                const isLastAssistantMsg = message.role === 'assistant' && !isStreaming && idx === messages.length - 1;

                return (
                  <MessageErrorBoundary key={message.id} messageId={message.id}>
                    <div>
                      <MessageBubble message={displayMessage} onCitationClick={onCitationClick} isStreaming={showStreaming} onRegenerate={isLastAssistantMsg ? () => void regenerateLastResponse() : undefined} isLastAssistant={isLastAssistantMsg} onContinue={isLastAssistantMsg && displayMessage.isTruncated ? () => void continueGenerating() : undefined} />
                      {displayCitations && displayCitations.length > 0 && (() => {
                        const uniqueCitations = displayCitations
                          .filter((citation, index, all) => all.findIndex((item) => item.refIndex === citation.refIndex) === index)
                          .sort((a, b) => a.refIndex - b.refIndex);
                        return (
                          <div className="mt-2 pl-0 flex flex-wrap gap-1.5">
                            {uniqueCitations.map((citation) => (
                              <CitationCard
                                key={`${message.id}-${citation.refIndex}`}
                                refIndex={citation.refIndex}
                                textSnippet={citation.textSnippet}
                                page={citation.page}
                                onClick={() => onCitationClick(citation)}
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
              className="pointer-events-auto p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md hover:shadow-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-shadow focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              aria-label="Scroll to bottom"
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
              role="progressbar"
              aria-valuenow={messagesUsed}
              aria-valuemin={0}
              aria-valuemax={maxMessages}
              aria-label="Messages used"
              className={`h-full transition-[width] duration-300 ${
                demoRemaining <= 2 ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
              }`}
              style={{ width: `${Math.max(0, (demoRemaining / maxUserMessages) * 100)}%` }}
            />
          </div>
          <div className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 flex items-center justify-between" aria-live="polite">
            <span className={demoRemaining <= 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
              {t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
            </span>
            {!demoLimitReached ? (
              <button type="button" onClick={() => router.push('?auth=1', { scroll: false })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-sm focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
                {t('demo.signInForUnlimited')}
              </button>
            ) : (
              <button type="button" onClick={() => router.push('?auth=1', { scroll: false })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-sm font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
                {t('demo.signInToContinue')}
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="p-4 border-t dark:border-zinc-700">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center px-3 py-1.5 gap-2 border border-zinc-300 dark:border-zinc-600 rounded-full bg-white dark:bg-zinc-800 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-colors">
            <PlusMenu
              isOpen={plusMenuOpen}
              setIsOpen={setPlusMenuOpen}
              menuRef={plusMenuRef}
              buttonRef={plusMenuButtonRef}
              onMenuKeyDown={handlePlusMenuKeyDown}
              showCustomInstructions={showCustomInstructions}
              showExportInMenu={showExportInMenu}
              canUseCustomInstructions={canUseCustomInstructions}
              hasCustomInstructions={hasCustomInstructions}
              canUseExport={canUseExport}
              onOpenSettings={onOpenSettings}
              onExport={handleExport}
              onBillingRedirect={() => {
                setPlusMenuOpen(false);
                router.push('/billing');
              }}
              t={t}
            />
            <textarea
              ref={textareaRef}
              className="flex-1 px-1 py-1 text-sm resize-none overflow-y-auto focus:outline-none bg-transparent dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              style={{ minHeight: '36px' }}
              placeholder={demoLimitReached ? t('demo.signInToContinue') : t('chat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isStreaming || demoLimitReached}
              rows={1}
              aria-label="Ask a question"
            />
            <div className="flex items-center shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="p-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  title={t('chat.stop') || 'Stop'}
                  aria-label="Stop generating"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="p-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-full disabled:opacity-40 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  disabled={!input.trim() || demoLimitReached}
                  title={t('chat.send')}
                  aria-label="Send message"
                >
                  <SendHorizontal size={18} />
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
