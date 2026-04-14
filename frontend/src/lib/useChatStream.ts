"use client";

import { useCallback, useMemo, useRef } from 'react';
import { chatStream, continueStream } from './sse';
import { useDocTalkStore } from '../store';
import type { Message } from '../types';
import { triggerCreditsRefresh } from '../components/CreditsDisplay';
import { errorCopy } from './errorCopy';

interface UseChatStreamOptions {
  sessionId: string;
  selectedMode: string;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
  maxUserMessages?: number;
  onShowPaywall: () => void;
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
  onShowPaywall,
  onRequireAuth,
}: UseChatStreamOptions): UseChatStreamResult {
  const {
    messages,
    isStreaming,
    demoMessagesUsed,
    addMessage,
    updateLastMessage,
    addCitationToLastMessage,
    setStreaming,
    updateSessionActivity,
    flushPendingText,
    markLastMessageTruncated,
    updateLastMessageMeta,
  } = useDocTalkStore();

  const abortRef = useRef<AbortController | null>(null);

  const localUserMsgCount = maxUserMessages != null
    ? messages.filter((m) => m.role === 'user').length
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

    if (name === 'AbortError' || message.includes('AbortError')) {
      return;
    }

    if (status === 402 || code === 'INSUFFICIENT_CREDITS' || code === 'MODE_NOT_ALLOWED') {
      onShowPaywall();
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

    addMessage({
      id: `m_${Date.now()}_e`,
      role: 'assistant',
      text: copy.body,
      isError: true,
      createdAt: Date.now(),
    });
  }, [addMessage, flushPendingText, getErrorMeta, onShowPaywall, setStreaming, t, tOr]);

  const handleTruncated = useCallback(() => {
    flushPendingText();
    markLastMessageTruncated(true);
  }, [flushPendingText, markLastMessageTruncated]);

  const handleStreamDone = useCallback((d: { message_id: string; can_continue?: boolean; continuation_count?: number }) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;
    updateSessionActivity(sessionId);
    triggerCreditsRefresh();
    if (d.message_id) {
      updateLastMessageMeta({
        backendId: d.message_id,
        ...(d.continuation_count !== undefined ? { continuationCount: d.continuation_count } : {}),
      });
    }
  }, [flushPendingText, setStreaming, updateSessionActivity, sessionId, updateLastMessageMeta]);

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
    );
  }, [sessionId, updateLastMessage, addCitationToLastMessage, handleStreamError, handleStreamDone, handleTruncated, selectedMode, locale]);

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

    await streamAssistantResponse(text);
    return true;
  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse]);

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
    setStreaming(true);

    await streamAssistantResponse(lastUserText);
  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse]);

  const continueGenerating = useCallback(async () => {
    if (isStreaming) return;

    const msgs = useDocTalkStore.getState().messages;
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isTruncated) return;

    // Clear truncated flag and start streaming
    markLastMessageTruncated(false);
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
    );
  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, handleStreamError, handleStreamDone, handleTruncated, selectedMode, locale]);

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
