"use client";

import { useCallback, useMemo, useRef } from 'react';
import { chatStream, continueStream } from './sse';
import { getMessages } from './api';
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

  // Shared by handleStreamError and the regenerate/continue catch blocks
  // below — both need to recognize a user-initiated abort the same way.
  const isAbortLikeError = useCallback((err: unknown): boolean => {
    const name = typeof err === 'object' && err && 'name' in err
      ? String((err as { name?: unknown }).name || '')
      : '';
    const message = typeof err === 'object' && err && 'message' in err
      ? String((err as { message?: unknown }).message || '')
      : '';
    return name === 'AbortError' || message.includes('AbortError');
  }, []);

  // Fire-and-forget re-sync to server truth after a regenerate/continue
  // failure — replaces the r2 ref-based rollback (Codex r3: a rollback token
  // could go stale across an aborted call and then incorrectly undo a later,
  // unrelated send's usage). GETs the current session's messages and, if the
  // response carries demo_messages_used (anon demo only), re-anchors BOTH
  // fields to "right now": the raw server count, and a baseline equal to the
  // LIVE transcript's current user-message count (not the fetched
  // transcript's) — so useChatStream's formula converges immediately without
  // needing a full page reload, regardless of whether the failed request
  // actually consumed server quota or not. Errors are swallowed: this is a
  // best-effort correction, not something that should surface to the user.
  const reanchorDemoCounter = useCallback((forSessionId: string) => {
    if (maxUserMessages == null) return;
    // Captured synchronously at call time (not read again after the GET
    // resolves) — see the epoch check below for why.
    const epochAtCall = useDocTalkStore.getState().demoAccountingEpoch;
    getMessages(forSessionId)
      .then((msgsData) => {
        if (msgsData.demo_messages_used == null) return;
        const state = useDocTalkStore.getState();
        // The GET can resolve after the user has already navigated away —
        // e.g. useChatSession's effect ran its synchronous reset for a NEW
        // document/session while this was in flight. Re-read the CURRENT
        // sessionId from the store (not a closure) and only write if it
        // still matches the session this reanchor was called for; otherwise
        // the fetched-for-A truth would clobber whatever B's own
        // adopt/create already established.
        if (state.sessionId !== forSessionId) return;
        // Same-session guard alone isn't enough (Codex r4): a failed
        // regenerate can issue this GET, and the user can send a NEW
        // message on the SAME session before it resolves — the sessionId
        // check can't see that, since sendMessage never changes sessionId.
        // demoAccountingEpoch is bumped by every operation that mutates
        // these two fields (adopt/create, sendMessage start, regen/continue
        // bump); if it moved since this reanchor was issued, some other
        // accounting event happened in between and its own state is
        // authoritative — writing this stale snapshot over it would erase
        // that newer event's delta. Drop it silently either way; a later
        // failure (if any) issues its own fresh reanchor against current
        // state.
        if (state.demoAccountingEpoch !== epochAtCall) return;
        state.setDemoMessagesUsed(msgsData.demo_messages_used);
        state.setDemoRestoredUserMsgCount(
          state.messages.filter((m) => m.role === 'user').length,
        );
      })
      .catch(() => {
        // best-effort — a later restore/regenerate/continue will try again
      });
  }, [maxUserMessages]);

  const handleStreamError = useCallback((err: unknown) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;

    const { message, code, status } = getErrorMeta(err);

    if (isAbortLikeError(err)) {
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
  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);

  const handleTruncated = useCallback(() => {
    flushPendingText();
    markLastMessageTruncated(true);
  }, [flushPendingText, markLastMessageTruncated]);

  const handleStreamDone = useCallback((d: {
    message_id: string;
    can_continue?: boolean;
    continuation_count?: number;
    quote_finder_hint?: boolean;
    quote_finder_topic?: string | null;
  }) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;
    updateSessionActivity(sessionId);
    triggerCreditsRefresh();
    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
    if (d.message_id) {
      updateLastMessageMeta({
        backendId: d.message_id,
        shareAnchor: messageShareAnchorFromId(d.message_id),
        ...(d.continuation_count !== undefined ? { continuationCount: d.continuation_count } : {}),
        quoteFinderHint: d.quote_finder_hint === true,
        quoteFinderTopic: d.quote_finder_topic ?? null,
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

  // `onErrorOverride` lets a caller observe an error before it reaches the
  // shared `handleStreamError` (used by regenerateLastResponse to trigger a
  // demo-counter re-anchor without changing sendMessage's behavior at all).
  const streamAssistantResponse = useCallback(async (prompt: string, onErrorOverride?: (err: unknown) => void) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const domainMode = useDocTalkStore.getState().domainMode;
    await chatStream(
      sessionId,
      prompt,
      ({ text }) => updateLastMessage(text || ''),
      (citation) => addCitationToLastMessage(citation),
      onErrorOverride ?? handleStreamError,
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
    // A new user message on this session is itself an accounting-relevant
    // event (it changes what localUserMsgCount will count) — bump so any
    // in-flight reanchorDemoCounter GET for this same session (e.g. from an
    // earlier failed regenerate/continue) recognizes its snapshot is now
    // stale and drops instead of overwriting this message's delta (Codex
    // r4). No-op for authenticated/non-demo sessions.
    if (maxUserMessages != null) useDocTalkStore.getState().bumpDemoAccountingEpoch();
    setStreaming(true);
    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });

    await streamAssistantResponse(text);
    return true;
  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse, selectedMode, maxUserMessages]);

  // Regenerate/continue add no new user message locally (they resend/extend
  // an existing turn), but the backend increments demo quota on both — so
  // without this the UI would undercount relative to the server. Bumps
  // demoMessagesUsed directly (not the baseline, which only moves at
  // restore/create) and optimistically, before the stream starts — correct
  // whenever the server actually charges, which is the dominant case,
  // including an abort (streaming can only be aborted once the backend has
  // already started responding, so it plausibly already charged). No
  // rollback here on failure — see reanchorDemoCounter above: instead of
  // guessing whether a given failure means the server charged or not (r3:
  // that guess is unsafe — e.g. the continuation endpoint charges quota
  // BEFORE validating the message is still continuable, so a 404/400 there
  // is still a real charge), a failed regenerate/continue re-syncs to
  // server truth directly. No-op outside demo (maxUserMessages == null), so
  // authenticated/non-demo sessions are untouched.
  const bumpDemoUsageForRegenOrContinue = useCallback(() => {
    if (maxUserMessages == null) return;
    const state = useDocTalkStore.getState();
    state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
    // This bump is itself an accounting-relevant event — see the epoch
    // check in reanchorDemoCounter above.
    state.bumpDemoAccountingEpoch();
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

    try {
      // Covers errors reported via the SSE error event/mid-stream failures
      // (which resolve normally, so a try/catch alone wouldn't see them) —
      // re-anchor before delegating to the shared error handler.
      await streamAssistantResponse(lastUserText, (err) => {
        reanchorDemoCounter(sessionId);
        handleStreamError(err);
      });
    } catch (e) {
      // Covers a thrown fetch() rejection (network failure before/instead
      // of any SSE response) — the one case the onError override above
      // can't see, since it never fires. Re-throws unchanged (nothing here
      // catches it today either) — this only adds the re-anchor.
      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
      throw e;
    }
  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, sessionId, handleStreamError, isAbortLikeError]);

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

    try {
      await continueStream(
        sessionId,
        lastMsg.backendId || '',
        ({ text }) => updateLastMessage(text || ''),
        (citation) => addCitationToLastMessage(citation),
        // Re-anchor before delegating — covers SSE error-event/mid-stream
        // failures, which resolve normally (see the try/catch below for the
        // thrown-fetch-rejection case a callback can't see).
        (err) => {
          reanchorDemoCounter(sessionId);
          handleStreamError(err);
        },
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
    } catch (e) {
      // Thrown fetch() rejection — re-throws unchanged (nothing here catches
      // it today either), this only adds the re-anchor.
      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
      throw e;
    }
  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, isAbortLikeError]);

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
