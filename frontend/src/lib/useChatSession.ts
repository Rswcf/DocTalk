"use client";

import { useEffect, useState } from 'react';
import { createSession, getMessages, listSessions } from './api';
import { useDocTalkStore } from '../store';

interface UseChatSessionResult {
  sessionError: string | null;
}

export function useChatSession(documentId: string | undefined): UseChatSessionResult {
  const [sessionError, setSessionError] = useState<string | null>(null);

  const documentStatus = useDocTalkStore((s) => s.documentStatus);
  const {
    setSessions,
    setSessionId,
    setMessages,
    setDemoMessagesUsed,
    addSession,
  } = useDocTalkStore();

  useEffect(() => {
    if (!documentId || documentStatus !== 'ready') return;

    setSessionError(null);
    let cancelled = false;

    (async () => {
      let sessionReady = false;
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
        console.error('Failed to load sessions, falling back to create:', e);
      }

      if (!sessionReady && !cancelled) {
        try {
          const s = await createSession(documentId);
          if (cancelled) return;

          setSessionId(s.session_id);
          if (s.demo_messages_used != null) {
            setDemoMessagesUsed(s.demo_messages_used);
          }

          const now = s.created_at || new Date().toISOString();
          addSession({
            session_id: s.session_id,
            title: null,
            message_count: 0,
            created_at: now,
            last_activity_at: now,
          });

          const summary = useDocTalkStore.getState().documentSummary;
          if (summary) {
            setMessages([{
              id: 'summary_synthetic',
              role: 'assistant',
              text: summary,
              createdAt: Date.now(),
            }]);
          } else {
            setMessages([]);
          }
        } catch (e) {
          console.error('Failed to create session:', e);
          if (!cancelled) setSessionError('Failed to initialize chat session.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, addSession]);

  return { sessionError };
}
