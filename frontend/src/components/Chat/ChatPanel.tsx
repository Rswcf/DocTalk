"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SendHorizontal, ArrowDown, Square, Share2 } from 'lucide-react';
import { exportConversationAsMarkdown } from '../../lib/export';
import type { Citation, Message } from '../../types';
import { useDocTalkStore } from '../../store';
import MessageBubble from './MessageBubble';
import CitationCard from './CitationCard';
import { useLocale } from '../../i18n';
import { PaywallModal } from '../PaywallModal';
import PlusMenu from './PlusMenu';
import DomainModeSelector from './DomainModeSelector';
import MessageErrorBoundary from './MessageErrorBoundary';
import { renumberCitations } from '../../lib/citations';
import { SUGGESTED_KEYS } from '../../lib/constants';
import { useChatStream } from '../../lib/useChatStream';
import { openAuthModal } from '../../lib/auth-modal';
import { errorCopy } from '../../lib/errorCopy';
import { billingHref } from '../../lib/billingLinks';
import { trackEvent } from '../../lib/analytics';
import { withShareAnchor } from '../../lib/shareAnchors';

/**
 * Per-message row rendered inside the chat scroll. Memoized so the SSE
 * 50ms flush cadence — which mutates only the streaming assistant message
 * — doesn't force every prior message to re-run ReactMarkdown + Shiki
 * (the I21 re-render storm). The parent (`ChatPanel`) passes stable
 * refs: `message` comes from the Zustand store which only allocates a
 * new object for the message it's mutating, and `onRegenerate` /
 * `onContinue` / `onShareAnswer` are useCallback-stabilized at the panel
 * level.
 *
 * The renumber + clone for assistant citations lives here (was at the
 * top of `messages.map` before — that ran on every parent render and
 * defeated `MessageBubble`'s `React.memo`). Inside this child, the
 * renumber is `useMemo`'d on `message.citations` ref, so it only
 * recomputes when the citations actually change.
 */
interface ChatMessageRowProps {
  message: Message;
  isStreaming: boolean;
  isLastAssistant: boolean;
  onCitationClick: (c: Citation) => void;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onShareAnswer?: (message: Message) => void;
  isSharingAnswer: boolean;
}

const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  isStreaming,
  isLastAssistant,
  onCitationClick,
  onRegenerate,
  onContinue,
  onShareAnswer,
  isSharingAnswer,
}: ChatMessageRowProps) {
  const displayCitations = React.useMemo(() => {
    if (message.role !== 'assistant') return undefined;
    if (!message.citations || message.citations.length === 0) return undefined;
    return renumberCitations(message.citations);
  }, [message.citations, message.role]);

  const displayMessage = React.useMemo(
    () => (displayCitations ? { ...message, citations: displayCitations } : message),
    [displayCitations, message]
  );

  const uniqueCitations = React.useMemo(() => {
    if (!displayCitations || displayCitations.length === 0) return undefined;
    return displayCitations
      .filter((citation, index, all) => all.findIndex((item) => item.refIndex === citation.refIndex) === index)
      .sort((a, b) => a.refIndex - b.refIndex);
  }, [displayCitations]);

  return (
    <MessageErrorBoundary messageId={message.id}>
      <div>
        <MessageBubble
          message={displayMessage}
          onCitationClick={onCitationClick}
          isStreaming={isStreaming}
          onRegenerate={onRegenerate}
          isLastAssistant={isLastAssistant}
          onContinue={onContinue}
          onShareAnswer={onShareAnswer}
          isSharingAnswer={isSharingAnswer}
        />
        {uniqueCitations && uniqueCitations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 pl-0">
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
        )}
      </div>
    </MessageErrorBoundary>
  );
});

interface ChatPanelProps {
  sessionId: string;
  onCitationClick: (c: Citation) => void;
  maxUserMessages?: number;
  suggestedQuestions?: string[];
  initialQuestion?: string;
  onOpenSettings?: () => void;
  hasCustomInstructions?: boolean;
  userPlan?: string;
  autoSubmitInitialQuestion?: boolean;
  // Whether this surface supports custom instructions at all. Document reader
  // uses it (true); collection chat doesn't (scope across multiple docs is
  // undefined). Default true to preserve existing single-doc behavior.
  supportsCustomInstructions?: boolean;
}

const autoSubmittedInitialQuestions = new Set<string>();

export default function ChatPanel({ sessionId, onCitationClick, maxUserMessages, suggestedQuestions, initialQuestion, onOpenSettings, hasCustomInstructions, userPlan, autoSubmitInitialQuestion = false, supportsCustomInstructions = true }: ChatPanelProps) {
  const messages = useDocTalkStore((s) => s.messages);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);
  const selectedMode = useDocTalkStore((s) => s.selectedMode);
  const addMessage = useDocTalkStore((s) => s.addMessage);
  const { t, tOr, locale } = useLocale();
  const router = useRouter();

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);

  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuButtonRef = useRef<HTMLButtonElement>(null);
  const initialQuestionSubmittedRef = useRef<string | null>(null);

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
    tOr,
    maxUserMessages,
    currentPlan: userPlan,
    onShowPaywall: (reason) => {
      setPaywallReason(reason ?? null);
      setShowPaywall(true);
    },
    onRequireAuth: () => openAuthModal(),
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
    const hasConversationMessages = messages.some((message) => message.id !== 'summary_synthetic');
    if (!initialQuestion || hasConversationMessages || isStreaming) return;

    if (autoSubmitInitialQuestion) {
      const autoSubmitKey = `${sessionId}:${initialQuestion}`;
      if (
        initialQuestionSubmittedRef.current === initialQuestion
        || autoSubmittedInitialQuestions.has(autoSubmitKey)
      ) return;
      initialQuestionSubmittedRef.current = initialQuestion;
      autoSubmittedInitialQuestions.add(autoSubmitKey);
      void sendMessage(initialQuestion).then((sent) => {
        if (!sent) {
          initialQuestionSubmittedRef.current = null;
          autoSubmittedInitialQuestions.delete(autoSubmitKey);
          setInput(initialQuestion);
          textareaRef.current?.focus();
        }
      });
      return;
    }

    if (input) return;
    setInput(initialQuestion);
    textareaRef.current?.focus();
  }, [autoSubmitInitialQuestion, initialQuestion, input, messages, isStreaming, sendMessage, sessionId]);

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

  const handleDemoAuthClick = useCallback(() => {
    trackEvent('upgrade_click', {
      source: 'demo_limit_panel',
      reason: 'demo_message_limit',
      plan: 'plus',
      period: 'monthly',
    });
    openAuthModal();
  }, []);

  const handleSuggestedClick = (question: string) => {
    setInput(question);
    void sendMessage(question).then((sent) => {
      if (sent) setInput('');
    });
  };

  const handleExport = useCallback(() => {
    trackEvent('export_clicked', { source: 'chat_plus_menu', format: 'markdown' });
    const docName = useDocTalkStore.getState().documentName || 'document';
    exportConversationAsMarkdown(messages, docName);
  }, [messages]);

  const handleExportFormat = useCallback(async (format: 'pdf' | 'docx') => {
    trackEvent('export_clicked', { source: 'chat_plus_menu', format });
    try {
      const { exportSession } = await import('../../lib/api');
      const blob = await exportSession(sessionId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      const copy = errorCopy(e, t, tOr);
      addMessage({
        id: `m_${Date.now()}_exp`,
        role: 'assistant',
        text: copy.body,
        isError: true,
        createdAt: Date.now(),
      });
    }
  }, [addMessage, sessionId, t, tOr]);

  const [shareLoading, setShareLoading] = useState(false);
  const [shareAnswerLoadingId, setShareAnswerLoadingId] = useState<string | null>(null);

  const copyShareUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      return;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const { createShare } = await import('../../lib/api');
      const result = await createShare(sessionId);
      await copyShareUrl(result.url);
      trackEvent('share_created', { source: 'chat_panel', plan: userPlan || 'unknown' });
      addMessage({
        id: `m_${Date.now()}_share_ok`,
        role: 'assistant',
        text: tOr('share.copied', 'Link copied to clipboard.'),
        createdAt: Date.now(),
      });
    } catch (e) {
      console.error('Share failed:', e);
      const copy = errorCopy(e, t, tOr);
      addMessage({
        id: `m_${Date.now()}_share_err`,
        role: 'assistant',
        text: copy.body,
        isError: true,
        createdAt: Date.now(),
      });
    } finally {
      setShareLoading(false);
    }
  }, [addMessage, copyShareUrl, sessionId, shareLoading, t, tOr, userPlan]);

  const handleShareAnswer = useCallback(async (message: Message) => {
    if (!message.shareAnchor || shareAnswerLoadingId) return;
    setShareAnswerLoadingId(message.id);
    try {
      const { createShare } = await import('../../lib/api');
      const result = await createShare(sessionId);
      const answerUrl = withShareAnchor(result.url, message.shareAnchor);
      await copyShareUrl(answerUrl);
      trackEvent('share_created', { source: 'answer_action', plan: userPlan || 'unknown' });
      addMessage({
        id: `m_${Date.now()}_share_answer_ok`,
        role: 'assistant',
        text: tOr('share.answerCopied', 'Answer link copied to clipboard.'),
        createdAt: Date.now(),
      });
    } catch (e) {
      console.error('Answer share failed:', e);
      const copy = errorCopy(e, t, tOr);
      addMessage({
        id: `m_${Date.now()}_share_answer_err`,
        role: 'assistant',
        text: copy.body,
        isError: true,
        createdAt: Date.now(),
      });
    } finally {
      setShareAnswerLoadingId(null);
    }
  }, [addMessage, copyShareUrl, sessionId, shareAnswerLoadingId, t, tOr, userPlan]);

  // Stable refs for the per-message row callbacks (I21). Previously the
  // arrow functions `() => void regenerateLastResponse()` / `() => void
  // continueGenerating()` / `(msg) => void handleShareAnswer(msg)` were
  // recreated on every render of `ChatPanel`, and `ChatPanel` re-renders
  // every ~50ms during SSE streaming (because the store's messages array
  // mutates on every text flush). Even with `MessageBubble` memoized,
  // those fresh arrow identities broke shallow-prop comparison and
  // forced every historical message to re-run ReactMarkdown + Shiki at
  // streaming cadence — O(n) work per flush. With these stabilized,
  // only the actively-streaming message (the one whose `.text` ref
  // changed) re-renders. The underlying mutations are already
  // useCallback'd in `useChatStream`, so these wrappers stay stable
  // across streaming flushes.
  const handleRegenerateLast = useCallback(() => {
    void regenerateLastResponse();
  }, [regenerateLastResponse]);
  const handleContinueLast = useCallback(() => {
    void continueGenerating();
  }, [continueGenerating]);
  const handleShareAnswerVoid = useCallback((msg: Message) => {
    void handleShareAnswer(msg);
  }, [handleShareAnswer]);

  const canUseCustomInstructions = !!onOpenSettings;
  // Show the entry only on surfaces that support the feature. Among those,
  // show the Pro upgrade hook to Free + Plus (Plus was previously hidden, a
  // UX inconsistency); Pro users see the unlocked, functional entry.
  // Anonymous (userPlan=undefined) stays hidden.
  const showCustomInstructions = supportsCustomInstructions && (
    canUseCustomInstructions || userPlan === 'free' || userPlan === 'plus'
  );
  const canUseExport = messages.length > 0 && !isStreaming && (userPlan === 'plus' || userPlan === 'pro');
  const showExportInMenu = messages.length > 0 && !isStreaming;

  const localizedSuggestedQuestions = [
    ...SUGGESTED_KEYS.map((key) => t(key)),
    tOr('chat.suggestedExtractTables', 'Extract all tables as CSV'),
    tOr('chat.suggestedCompareVersions', 'Compare this with an older version'),
  ];
  // Backend generates document-specific suggested questions in the user's locale;
  // trust them regardless of `locale`. Falling back to the localized canned set
  // only when the backend hasn't supplied any. Previously this was gated on
  // `locale === 'en'`, which meant non-English users never saw document-aware
  // suggestions.
  const displayedSuggestedQuestions = suggestedQuestions && suggestedQuestions.length > 0
    ? suggestedQuestions
    : localizedSuggestedQuestions;

  return (
    <div className="dt-chat-shell flex h-full flex-col">
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
        currentPlan={userPlan}
      />
      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          data-tour="chat-area"
          className="dt-chat-scroll h-full overflow-y-auto overflow-x-hidden px-4 pb-10 pt-4 sm:px-6 sm:pb-12 lg:px-7"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center px-2 py-8">
              <div className="dt-empty-workbench rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--workbench-muted)]">DocTalk</p>
                    <p className="mt-1 text-sm font-medium text-[var(--workbench-ink)]">{t('chat.trySuggested')}</p>
                  </div>
                  <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-white/14 bg-white/8 text-xs font-mono font-semibold text-white/72">
                    01
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                {displayedSuggestedQuestions.map((question, index) => (
                  <button
                    key={`sq-${index}`}
                    type="button"
                    onClick={() => handleSuggestedClick(question)}
                    className="dt-suggested-question min-h-12 rounded-lg px-3 py-2 text-left text-sm leading-snug focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  >
                    {question}
                  </button>
                ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl pb-2">
              {messages.map((message, idx) => {
                const isLastMessage = idx === messages.length - 1;
                const showStreaming = isLastMessage && isStreaming && message.role === 'assistant';
                const isLastAssistantMsg = message.role === 'assistant' && !isStreaming && isLastMessage;
                // Pass `message` directly — the store keeps stable refs for
                // non-streaming messages, so React.memo on ChatMessageRow
                // can skip re-rendering historical rows during a stream.
                // Callbacks are gated by message position so only the last
                // assistant message receives non-undefined refs.
                return (
                  <ChatMessageRow
                    key={message.id}
                    message={message}
                    isStreaming={showStreaming}
                    isLastAssistant={isLastAssistantMsg}
                    onCitationClick={onCitationClick}
                    onRegenerate={isLastAssistantMsg ? handleRegenerateLast : undefined}
                    onContinue={isLastAssistantMsg && message.isTruncated ? handleContinueLast : undefined}
                    onShareAnswer={userPlan ? handleShareAnswerVoid : undefined}
                    isSharingAnswer={shareAnswerLoadingId === message.id}
                  />
                );
              })}
            </div>
          )}
        </div>
        {messages.length > 0 && showScrollBtn && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10">
            <button
              onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}
              className="pointer-events-auto rounded-full border border-white/14 bg-white/10 p-2 text-[var(--workbench-muted)] shadow-md transition-shadow hover:text-white hover:shadow-lg focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              aria-label={t('chat.scrollToBottom')}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        )}
      </div>

      {maxUserMessages != null && (
        <div className="border-t border-[var(--workbench-border)]">
          <div className="h-1 bg-white/10">
            <div
              role="progressbar"
              aria-valuenow={messagesUsed}
              aria-valuemin={0}
              aria-valuemax={maxMessages}
              aria-label={t('chat.messagesUsed')}
              className={`h-full transition-[width] duration-300 ${
                demoRemaining <= 2 ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
              }`}
              style={{ width: `${Math.max(0, (demoRemaining / maxUserMessages) * 100)}%` }}
            />
          </div>
          {demoLimitReached ? (
            <div className="px-4 py-3 sm:px-6" aria-live="polite">
              <div className="dt-stitch-card mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {tOr('demo.limitPanel.title', 'Ready to use DocTalk on your own files?')}
                  </p>
                  <p className="mt-1 text-[var(--workbench-muted)]">
                    {tOr('demo.limitPanel.body', 'Create a free account to upload documents, keep chats, and start with free credits.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDemoAuthClick}
                  className="dt-stitch-primary inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {tOr('demo.limitPanel.cta', 'Upload your own document')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 text-sm text-[var(--workbench-muted)]" aria-live="polite">
              <span className={demoRemaining <= 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                {t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
              </span>
              <button type="button" onClick={() => openAuthModal()} className="text-sm text-[var(--workbench-muted)] hover:text-white hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-zinc-400">
                {t('demo.signInForUnlimited')}
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="dt-composer-shell px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {userPlan && (
            <div className="mb-2 flex justify-end">
              <DomainModeSelector userPlan={userPlan} />
            </div>
          )}
          <div className="dt-composer flex items-center gap-2 rounded-[1.75rem] px-3 py-2 transition-[border-color,box-shadow]">
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
              onExportPdf={() => handleExportFormat('pdf')}
              onExportDocx={() => handleExportFormat('docx')}
              onBillingRedirect={(intent) => {
                setPlusMenuOpen(false);
                trackEvent('upgrade_click', {
                  plan: intent.plan,
                  period: 'monthly',
                  source: 'chat_plus_menu',
                  reason: intent.reason,
                });
                router.push(billingHref({ plan: intent.plan, source: 'chat_plus_menu', reason: intent.reason }));
              }}
              t={t}
              tOr={tOr}
            />
            {messages.length > 0 && !isStreaming && userPlan && (
              <button
                type="button"
                onClick={handleShare}
                disabled={shareLoading}
                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
                title={tOr('chat.share', 'Share conversation')}
                aria-label={tOr('chat.share', 'Share conversation')}
              >
                <Share2 size={16} />
              </button>
            )}
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm text-[var(--workbench-ink)] placeholder:text-white/38 focus:outline-none"
              style={{ minHeight: '36px' }}
              placeholder={demoLimitReached ? t('demo.signInToContinue') : t('chat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isStreaming || demoLimitReached}
              rows={1}
              aria-label={t('chat.placeholder')}
            />
            <div className="flex items-center shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="dt-stitch-primary rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                  title={tOr('chat.stop', 'Stop')}
                  aria-label={t('chat.stop')}
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="dt-stitch-primary rounded-full p-2 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                  disabled={!input.trim() || demoLimitReached}
                  title={t('chat.send')}
                  aria-label={t('chat.send')}
                >
                  <SendHorizontal size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      <div className="bg-transparent pb-2 text-center">
        <p className="mx-auto max-w-4xl text-xs text-white/36">
          {t('chat.disclaimer')}
        </p>
      </div>
    </div>
  );
}
