"use client";

import { useCallback, useMemo, useRef } from 'react';
import { chatStream } from './sse';
import { useDocTalkStore } from '../store';
import type { Message } from '../types';
import { triggerCreditsRefresh } from '../components/CreditsDisplay';

interface UseChatStreamOptions {
  sessionId: string;
  selectedMode: string;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  maxUserMessages?: number;
  onShowPaywall: () => void;
  onRequireAuth: () => void;
}

interface UseChatStreamResult {
  sendMessage: (text: string) => Promise<boolean>;
  regenerateLastResponse: () => Promise<void>;
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

  const getErrorMessage = useCallback((err: unknown): string => {
    if (typeof err === 'object' && err && 'message' in err) {
      return String((err as { message?: unknown }).message || '');
    }
    return '';
  }, []);

  const getFriendlyStreamError = useCallback((err: unknown): string | null => {
    const message = getErrorMessage(err);
    const name = typeof err === 'object' && err && 'name' in err
      ? String((err as { name?: unknown }).name || '')
      : '';

    if (name === 'AbortError' || message.includes('AbortError')) {
      return null;
    }

    if (message.includes('Failed to fetch')) {
      return t('chat.networkError');
    }

    return t('chat.networkError');
  }, [getErrorMessage, t]);

  const handleStreamError = useCallback((err: unknown) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;

    const errorMessage = getErrorMessage(err);

    if (errorMessage.includes('HTTP 402')) {
      onShowPaywall();
      return;
    }

    if (errorMessage.includes('HTTP 409')) {
      addMessage({
        id: `m_${Date.now()}_proc`,
        role: 'assistant',
        text: t('doc.processing'),
        createdAt: Date.now(),
      });
      return;
    }

    if (errorMessage.includes('HTTP 429')) {
      addMessage({
        id: `m_${Date.now()}_limit`,
        role: 'assistant',
        text: errorMessage.includes('Rate limit exceeded') ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
        createdAt: Date.now(),
      });
      return;
    }

    const errText = getFriendlyStreamError(err);
    if (!errText) return;

    addMessage({
      id: `m_${Date.now()}_e`,
      role: 'assistant',
      text: errText,
      isError: true,
      createdAt: Date.now(),
    });
  }, [flushPendingText, setStreaming, getErrorMessage, onShowPaywall, addMessage, t, getFriendlyStreamError]);

  const handleStreamDone = useCallback(() => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;
    updateSessionActivity(sessionId);
    triggerCreditsRefresh();
  }, [flushPendingText, setStreaming, updateSessionActivity, sessionId]);

  const streamAssistantResponse = useCallback(async (prompt: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    await chatStream(
      sessionId,
      prompt,
      ({ text }) => updateLastMessage(text || ''),
      (citation) => addCitationToLastMessage(citation),
      handleStreamError,
      handleStreamDone,
      selectedMode,
      locale,
      controller.signal,
    );
  }, [sessionId, updateLastMessage, addCitationToLastMessage, handleStreamError, handleStreamDone, selectedMode, locale]);

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

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    flushPendingText();
    setStreaming(false);
  }, [flushPendingText, setStreaming]);

  return useMemo(() => ({
    sendMessage,
    regenerateLastResponse,
    stopStreaming,
    demoRemaining,
    demoLimitReached,
    messagesUsed,
    maxMessages,
  }), [sendMessage, regenerateLastResponse, stopStreaming, demoRemaining, demoLimitReached, messagesUsed, maxMessages]);
}
