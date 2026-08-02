"use client";

import { useCallback, useMemo, useRef } from 'react';
import { chatStream, continueStream } from './sse';
import { useDocTalkStore } from '../store';
import type { Message } from '../types';
import { triggerCreditsRefresh } from '../components/CreditsDisplay';
import { errorCopy } from './errorCopy';
import { trackEvent } from './analytics';
import { messageShareAnchorFromId } from './shareAnchors';
import { deriveUpgradePlan } from './billingLinks';

interface UseChatStreamOptions {
  sessionId: string;
  selectedMode: string;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
  maxUserMessages?: number;
  /**
   * Current user's billing tier ('free' | 'plus' | 'pro' | undefined for
   * anonymous/demo). Used by the paywall analytics events so the funnel data
   * reflects the actual upgrade *target* — e.g. a Plus user hitting the Pro
   * cap should fire `plan: 'pro'`, not the hardcoded `plan: 'plus'` that was
   * poisoning every paywall_opened/limit_hit event in the funnel (I27).
   */
  currentPlan?: string;
  onShowPaywall: (reason?: string) => void;
  onRequireAuth: () => void;
}

interface UseChatStreamResult {
  sendMessage: (text: string) => Promise<boolean>;
  regenerateLastResponse: () => Promise<void>;
  continueGenerating: () => Promise<void>;
  stopStreaming: () => void;
  demoRemaining: number;
  demoLimitReached: boolean;
  messagesUsed: number;
  maxMessages: number;
}

export function useChatStream({
  sessionId,
  selectedMode,
  locale,
  t,
  tOr,
  maxUserMessages,
  currentPlan,
  onShowPaywall,
  onRequireAuth,
}: UseChatStreamOptions): UseChatStreamResult {
  const {
    messages,
    isStreaming,
    demoMessagesUsed,
    demoRestoredUserMsgCount,
    addMessage,
    updateLastMessage,
    addCitationToLastMessage,
    addArtifactToLastMessage,
    setLastMessageToolStatus,
    setStreaming,
    updateSessionActivity,
    flushPendingText,
    markLastMessageTruncated,
    updateLastMessageMeta,
  } = useDocTalkStore();

  const abortRef = useRef<AbortController | null>(null);
  // Pending rollback value for an optimistic regenerate/continue quota bump
  // (see bumpDemoUsageForRegenOrContinue below) — null when no bump is
  // awaiting resolution. Set right before the bump, consumed (cleared) by
  // whichever of handleStreamDone/handleStreamError fires next.
  const preBumpDemoUsedRef = useRef<number | null>(null);

  // Contract: totalUsed = demoMessagesUsed (server-known count as of the last
  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
  // is the baseline set at that restore/create point — how many of the
  // transcript's user messages were already reflected in demoMessagesUsed —
  // so only messages appended AFTER it count as "new". This converges to
  // server truth on every restore, including Redis TTL expiry / IP changes
  // (server reports 0 even though the transcript has old messages), instead
  // of a fixed subtraction that could outlive the server's own window and
  // hard-lock a user the backend would actually allow.
  const userMsgsInTranscript = maxUserMessages != null
    ? messages.filter((m) => m.role === 'user').length
    : 0;
  const localUserMsgCount = maxUserMessages != null
    ? Math.max(0, userMsgsInTranscript - demoRestoredUserMsgCount)
    : 0;
  const totalUsed = demoMessagesUsed + localUserMsgCount;
  const demoRemaining = maxUserMessages != null ? maxUserMessages - totalUsed : Infinity;
  const demoLimitReached = maxUserMessages != null && demoRemaining <= 0;
  const messagesUsed = maxUserMessages != null ? Math.min(maxUserMessages, Math.max(0, totalUsed)) : 0;
  const maxMessages = maxUserMessages ?? 0;

  const getErrorMeta = useCallback(
    (err: unknown): { message: string; code: string | null; status: number | null } => {
      if (typeof err === 'object' && err) {
        const anyErr = err as Record<string, unknown>;
        return {
          message: typeof anyErr.message === 'string' ? anyErr.message : '',
          code: typeof anyErr.code === 'string' ? anyErr.code : null,
          status: typeof anyErr.status === 'number' ? anyErr.status : null,
        };
      }
      return { message: '', code: null, status: null };
    },
    [],
  );

  const handleStreamError = useCallback((err: unknown) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;

    const { message, code, status } = getErrorMeta(err);
    const name = typeof err === 'object' && err && 'name' in err
      ? String((err as { name?: unknown }).name || '')
      : '';
    const isAbort = name === 'AbortError' || message.includes('AbortError');

    // Roll back a pending optimistic regenerate/continue quota bump (see
    // bumpDemoUsageForRegenOrContinue) on any non-abort failure. We can't
    // know for certain whether the backend's quota check ran before or
    // after whatever rejected this request, so this is a heuristic, not a
    // guarantee — any residual drift self-corrects on the next session
    // restore, which always re-syncs to the server's raw count. On an
    // explicit user abort we leave the bump in place: streaming can only be
    // aborted once the backend has already started responding, at which
    // point it plausibly already charged.
    const pendingDemoBumpRestore = preBumpDemoUsedRef.current;
    preBumpDemoUsedRef.current = null;
    if (!isAbort && pendingDemoBumpRestore != null) {
      useDocTalkStore.getState().setDemoMessagesUsed(pendingDemoBumpRestore);
    }

    if (isAbort) {
      return;
    }

    if (
      status === 402
      || code === 'INSUFFICIENT_CREDITS'
      || code === 'MODE_NOT_ALLOWED'
      || code === 'PRO_MODE_LIMIT_REACHED'
      || code === 'BALANCED_MODE_LIMIT_REACHED'
    ) {
      const reason = code || 'paid_limit';
      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
      // every paywall event in the funnel to plus-upgrade intent regardless
      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
      // as a Plus-upgrade event). Derive the actual upgrade target from
      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
      onShowPaywall(reason);
      return;
    }

    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
      addMessage({
        id: `m_${Date.now()}_proc`,
        role: 'assistant',
        text: t('doc.processing'),
        createdAt: Date.now(),
      });
      return;
    }

    if (
      status === 429
      || code === 'RATE_LIMITED'
      || code === 'DEMO_SESSION_RATE_LIMITED'
      || code === 'DEMO_MESSAGE_LIMIT_REACHED'
      || code === 'DEMO_SESSION_LIMIT_REACHED'
    ) {
      trackEvent('limit_hit', { source: 'chat_stream', reason: code || 'rate_or_demo_limit' });
      const isRateLimited = code === 'RATE_LIMITED'
        || code === 'DEMO_SESSION_RATE_LIMITED'
        || message.includes('Rate limit exceeded');
      addMessage({
        id: `m_${Date.now()}_limit`,
        role: 'assistant',
        text: isRateLimited ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
        createdAt: Date.now(),
      });
      return;
    }

    const copy = errorCopy(err, t, tOr);
    const state = useDocTalkStore.getState();
    const currentMessages = state.messages;
    const lastMessage = currentMessages[currentMessages.length - 1];
    const lastAssistantIsEmpty = lastMessage?.role === 'assistant'
      && !lastMessage.text
      && !lastMessage.toolStatus
      && (!lastMessage.citations || lastMessage.citations.length === 0)
      && (!lastMessage.artifacts || lastMessage.artifacts.length === 0);

    if (lastAssistantIsEmpty) {
      state.setMessages([
        ...currentMessages.slice(0, -1),
        {
          ...lastMessage,
          text: copy.body,
          isError: true,
          isTruncated: false,
        },
      ]);
      return;
    }

    addMessage({
      id: `m_${Date.now()}_e`,
      role: 'assistant',
      text: copy.body,
      isError: true,
      createdAt: Date.now(),
    });
  }, [addMessage, flushPendingText, getErrorMeta, onShowPaywall, setStreaming, t, tOr, currentPlan]);

  const handleTruncated = useCallback(() => {
    flushPendingText();
    markLastMessageTruncated(true);
  }, [flushPendingText, markLastMessageTruncated]);

  const handleStreamDone = useCallback((d: { message_id: string; can_continue?: boolean; continuation_count?: number }) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;
    // Stream completed successfully — any pending regenerate/continue quota
    // bump stands (no rollback needed).
    preBumpDemoUsedRef.current = null;
    updateSessionActivity(sessionId);
    triggerCreditsRefresh();
    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
    if (d.message_id) {
      updateLastMessageMeta({
        backendId: d.message_id,
        shareAnchor: messageShareAnchorFromId(d.message_id),
        ...(d.continuation_count !== undefined ? { continuationCount: d.continuation_count } : {}),
      });
    }
  }, [flushPendingText, setStreaming, updateSessionActivity, sessionId, selectedMode, updateLastMessageMeta]);

  const handleAnswerRepaired = useCallback((payload: { text: string; citations: Message['citations'] }) => {
    flushPendingText();
    updateLastMessageMeta({
      text: payload.text,
      citations: payload.citations || [],
      isTruncated: false,
      toolStatus: undefined,
    });
  }, [flushPendingText, updateLastMessageMeta]);

  // Text-preserving citation update: sentence-level focus added after the
  // answer (cross-lingual / paraphrase). Only the citations change.
  const handleCitationsRefined = useCallback((citations: Message['citations']) => {
    flushPendingText();
    updateLastMessageMeta({ citations: citations || [] });
  }, [flushPendingText, updateLastMessageMeta]);

  const streamAssistantResponse = useCallback(async (prompt: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const domainMode = useDocTalkStore.getState().domainMode;
    await chatStream(
      sessionId,
      prompt,
      ({ text }) => updateLastMessage(text || ''),
      (citation) => addCitationToLastMessage(citation),
      handleStreamError,
      handleStreamDone,
      handleTruncated,
      selectedMode,
      locale,
      controller.signal,
      domainMode,
      (artifact) => addArtifactToLastMessage(artifact),
      ({ message }) => setLastMessageToolStatus(message),
      handleAnswerRepaired,
      handleCitationsRefined,
    );
  }, [sessionId, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return false;

    if (demoLimitReached) {
      onRequireAuth();
      return false;
    }

    const userMsg: Message = {
      id: `m_${Date.now()}_u`,
      role: 'user',
      text,
      createdAt: Date.now(),
    };

    const asstMsg: Message = {
      id: `m_${Date.now()}_a`,
      role: 'assistant',
      text: '',
      citations: [],
      createdAt: Date.now(),
    };

    addMessage(userMsg);
    addMessage(asstMsg);
    setStreaming(true);
    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });

    await streamAssistantResponse(text);
    return true;
  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse, selectedMode]);

  // Regenerate/continue add no new user message locally (they resend/extend
  // an existing turn), but the backend increments demo quota on both — so
  // without this the UI would undercount relative to the server. Bumps
  // demoMessagesUsed directly (not the baseline, which only moves at
  // restore/create) and optimistically, before the stream starts — same
  // timing as `sendMessage`'s optimistic user-message add. Unlike
  // sendMessage's bump (which is inherent to the persisted transcript and
  // was already accepted as unconditional), this one records the pre-bump
  // value so handleStreamError can roll it back on failure — see there for
  // why. No-op outside demo (maxUserMessages == null), so authenticated/
  // non-demo sessions are untouched.
  const bumpDemoUsageForRegenOrContinue = useCallback(() => {
    if (maxUserMessages == null) return;
    const state = useDocTalkStore.getState();
    preBumpDemoUsedRef.current = state.demoMessagesUsed;
    state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
  }, [maxUserMessages]);

  const regenerateLastResponse = useCallback(async () => {
    if (isStreaming) return;

    const msgs = useDocTalkStore.getState().messages;
    let lastUserIdx = -1;

    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx === -1) return;

    const lastUserText = msgs[lastUserIdx].text;
    const trimmed = msgs.slice(0, lastUserIdx + 1);

    useDocTalkStore.getState().setMessages(trimmed);
    addMessage({ id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() });
    bumpDemoUsageForRegenOrContinue();
    setStreaming(true);

    await streamAssistantResponse(lastUserText);
  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue]);

  const continueGenerating = useCallback(async () => {
    if (isStreaming) return;

    const msgs = useDocTalkStore.getState().messages;
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isTruncated) return;

    // Clear truncated flag and start streaming
    markLastMessageTruncated(false);
    bumpDemoUsageForRegenOrContinue();
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await continueStream(
      sessionId,
      lastMsg.backendId || '',
      ({ text }) => updateLastMessage(text || ''),
      (citation) => addCitationToLastMessage(citation),
      handleStreamError,
      handleStreamDone,
      handleTruncated,
      selectedMode,
      locale,
      controller.signal,
      (artifact) => addArtifactToLastMessage(artifact),
      ({ message }) => setLastMessageToolStatus(message),
      handleAnswerRepaired,
      handleCitationsRefined,
    );
  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    flushPendingText();
    setStreaming(false);
  }, [flushPendingText, setStreaming]);

  return useMemo(() => ({
    sendMessage,
    regenerateLastResponse,
    continueGenerating,
    stopStreaming,
    demoRemaining,
    demoLimitReached,
    messagesUsed,
    maxMessages,
  }), [sendMessage, regenerateLastResponse, continueGenerating, stopStreaming, demoRemaining, demoLimitReached, messagesUsed, maxMessages]);
}
