"use client";

import { useEffect, useState } from 'react';
import { ApiError, createSession, getMessages, listSessions } from './api';
import { useDocTalkStore } from '../store';

interface UseChatSessionResult {
  sessionError: unknown | null;
}

export function useChatSession(documentId: string | undefined): UseChatSessionResult {
  const [sessionError, setSessionError] = useState<unknown | null>(null);

  const documentStatus = useDocTalkStore((s) => s.documentStatus);
  const {
    setSessions,
    setSessionId,
    setMessages,
    setDemoMessagesUsed,
    setDemoRestoredUserMsgCount,
    addSession,
  } = useDocTalkStore();

  useEffect(() => {
    if (!documentId || documentStatus !== 'ready') return;

    setSessionError(null);
    let cancelled = false;

    (async () => {
      let sessionReady = false;

      // Anonymous demo: re-adopt the session we created earlier this browser
      // session instead of burning a create per page view (5-per-5min IP cap).
      // Safe for authed users too: if a signed-in caller inherits a stale key
      // from an earlier anonymous visit, `getMessages` 404s for them (the
      // session is anon-owned; `verify_session_access` in chat.py:157-163
      // only returns it to `user is None` callers), so the catch below
      // clears the key and falls through to the normal listSessions flow.
      const demoKey = `dt-demo-session:${documentId}`;
      const storedDemoSession = typeof window !== 'undefined' ? sessionStorage.getItem(demoKey) : null;
      if (storedDemoSession) {
        try {
          const msgsData = await getMessages(storedDemoSession);
          if (cancelled) return;
          setSessionId(storedDemoSession);
          // Populate the sessions list (not []) so SessionDropdown shows the
          // adopted session instead of an empty "New Chat"-only placeholder.
          // getMessages doesn't return session metadata, so derive
          // created_at/last_activity_at from the fetched messages' own
          // timestamps (falling back to now if there are none yet).
          const firstMsgAt = msgsData.messages[0]?.createdAt;
          const lastMsgAt = msgsData.messages[msgsData.messages.length - 1]?.createdAt;
          const createdAt = firstMsgAt != null ? new Date(firstMsgAt).toISOString() : new Date().toISOString();
          const lastActivityAt = lastMsgAt != null ? new Date(lastMsgAt).toISOString() : createdAt;
          setSessions([{
            session_id: storedDemoSession,
            title: null,
            message_count: msgsData.messages.length,
            created_at: createdAt,
            last_activity_at: lastActivityAt,
          }]);
          setMessages(msgsData.messages);
          // Baseline model (useChatStream.ts): totalUsed = demoMessagesUsed
          // (server-known usage AS OF THIS RESTORE) + messages sent locally
          // since then. demoRestoredUserMsgCount records how many of the
          // transcript's user messages are already covered by
          // demoMessagesUsed, so useChatStream only counts NEW ones on top.
          // demoMessagesUsed is the raw server value — NOT subtracted — so a
          // restore always converges to server truth, including when the
          // 24h Redis window has expired or the IP changed (server reports
          // 0 even though the transcript has old messages): that previously
          // made the UI hard-lock a user the backend would actually allow.
          const restoredUserMsgCount = msgsData.messages.filter((m) => m.role === 'user').length;
          setDemoRestoredUserMsgCount(restoredUserMsgCount);
          setDemoMessagesUsed(msgsData.demo_messages_used ?? 0);
          return; // adopted — skip listSessions/createSession entirely
        } catch {
          sessionStorage.removeItem(demoKey); // stale/pruned session — fall through
        }
      }

      try {
        const sessionsData = await listSessions(documentId);
        if (cancelled) return;

        setSessions(sessionsData.sessions);
        if (sessionsData.sessions.length > 0) {
          const latest = sessionsData.sessions[0];
          setSessionId(latest.session_id);
          const msgsData = await getMessages(latest.session_id);
          if (!cancelled) setMessages(msgsData.messages);
          sessionReady = true;
        }
      } catch (e) {
        console.warn('Failed to load sessions, falling back to create:', e);
      }

      if (!sessionReady && !cancelled) {
        try {
          const s = await createSession(documentId);
          if (cancelled) return;

          setSessionId(s.session_id);
          if (s.demo_messages_used != null) {
            // Fresh session, empty transcript — nothing restored yet, so the
            // baseline is 0 and every subsequent local user message counts.
            setDemoRestoredUserMsgCount(0);
            setDemoMessagesUsed(s.demo_messages_used);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`dt-demo-session:${documentId}`, s.session_id);
            }
          }

          const now = s.created_at || new Date().toISOString();
          addSession({
            session_id: s.session_id,
            title: null,
            message_count: 0,
            created_at: now,
            last_activity_at: now,
          });

          setMessages([]);
        } catch (e) {
          const expectedRateLimit = e instanceof ApiError && (e.code === 'DEMO_SESSION_RATE_LIMITED' || e.status === 429);
          if (!expectedRateLimit) {
            console.error('Failed to create session:', e);
          }
          if (!cancelled) setSessionError(e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, setDemoRestoredUserMsgCount, addSession]);

  return { sessionError };
}
