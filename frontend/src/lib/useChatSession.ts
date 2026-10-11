"use client";

import { useEffect, useState } from 'react';
import { ApiError, createSession, getMessages, listSessions } from './api';
import { useDocTalkStore } from '../store';
import { clearDemoSession, readDemoSession, writeDemoSession } from './demoSessionStorage';

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
    bumpDemoAccountingEpoch,
    addSession,
  } = useDocTalkStore();

  useEffect(() => {
    if (!documentId || documentStatus !== 'ready') return;

    setSessionError(null);
    // Reset the demo counter baseline synchronously here — NOT in
    // clearDocumentTransientState (Codex r2 #2 finding: that function is
    // ALSO invoked by useDocumentLoader's effect, whose deps include the
    // locale-sensitive `t`/`tOr`, so a same-document language change would
    // zero the counter while the transcript stayed, reintroducing the
    // TTL-hard-lock bug). This effect's own deps (below) exclude locale —
    // it only reruns on a real documentId transition — and always
    // re-establishes server truth right after via adopt-or-create in the
    // same run, so the momentary reset here is safe.
    setDemoMessagesUsed(0);
    setDemoRestoredUserMsgCount(0);
    // Bump the accounting epoch on every reset — see the field's doc comment
    // in store/index.ts. A reanchorDemoCounter GET issued before this reset
    // (e.g. for the PREVIOUS document's session) must never be allowed to
    // write over whatever this run establishes, even in the (currently
    // impossible, but not worth relying on) case its own sessionId happened
    // to collide.
    bumpDemoAccountingEpoch();
    // Clear the PREVIOUS document's session/messages/sessions synchronously
    // too (Codex r3 breakage 3), not just the counter. Without this, a
    // transient adoption failure for document B left document A's still-
    // truthy sessionId/messages sitting in the store; DocumentReaderPageClient
    // renders `documentStatus === 'ready' && sessionId ? <ChatPanel/> :
    // sessionErrorCopy ? <error/> : ...` — checking sessionId BEFORE the
    // error — so it kept showing A's stale chat instead of B's retryable
    // error. This also closes a pre-existing (unrelated) stale-chat flash on
    // any in-app document transition, since A's session/messages previously
    // lingered in the store until B's adopt/create resolved. The brief
    // sessionId===null window this creates renders a benign "initializing
    // chat" placeholder (DocumentReaderPageClient's final else branch), not
    // a blank/broken state.
    setSessionId(null);
    setMessages([]);
    setSessions([]);
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
      const storedDemoSession = readDemoSession(documentId);
      if (storedDemoSession) {
        try {
          const msgsData = await getMessages(storedDemoSession);
          if (cancelled) return;
          // A New Chat from the session menu may have published a session
          // while this loaded; keep it (it installed its own accounting).
          if (useDocTalkStore.getState().sessionId) return;
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
          bumpDemoAccountingEpoch();
          return; // adopted — skip listSessions/createSession entirely
        } catch (e) {
          const status = e instanceof ApiError ? e.status : null;
          if (status === 404 || status === 403) {
            // Confirmed gone or inaccessible (pruned by nightly cleanup, or
            // an authed caller inheriting an anon-owned key) — clear the
            // pointer and fall through to the normal listSessions/
            // createSession flow below. Only while the pointer still names
            // this session: a New Chat from the session menu may have moved
            // it meanwhile.
            if (readDemoSession(documentId) === storedDemoSession) clearDemoSession(documentId);
          } else {
            // Transient failure (network blip, 5xx) — the pointer is still
            // valid and the session most likely still exists. Falling
            // through to createSession here would silently orphan it:
            // listSessions always returns [] for anon demo, so createSession
            // would succeed and overwrite the still-good pointer (Codex r2
            // #3 repro). Surface a retryable error and stop instead — the
            // reader already renders an error state for sessionError, and a
            // reload re-runs this same effect from the top.
            if (!cancelled) setSessionError(e);
            return;
          }
        }
      }

      // From here on, a session the menu opened or created while the steps
      // above awaited wins over the one this effect would pick or create.
      if (useDocTalkStore.getState().sessionId) return;

      try {
        const sessionsData = await listSessions(documentId);
        if (cancelled) return;

        setSessions(sessionsData.sessions);
        if (sessionsData.sessions.length > 0) {
          const latest = sessionsData.sessions[0];
          // Fetch the transcript BEFORE publishing the session id, as the
          // adoption branch above does. The reader mounts ChatPanel as soon
          // as sessionId is set, and ChatPanel reads an empty transcript as
          // a fresh session: a demo `?question=` link auto-submits into it.
          // A transcript that lands after that send replaces the local
          // question/answer pair, and every streamed token is then appended
          // to whatever message is last — the question the backend has
          // already committed (2026-10-10: the answer rendered inside the
          // user bubble), or the previous answer.
          const msgsData = await getMessages(latest.session_id);
          if (cancelled) return;
          // The session menu lists the rows published above, so the user
          // may already have opened one while this loaded; keep it.
          if (useDocTalkStore.getState().sessionId) return;
          setSessionId(latest.session_id);
          setMessages(msgsData.messages);
          sessionReady = true;
        }
      } catch (e) {
        console.warn('Failed to load sessions, falling back to create:', e);
      }

      if (!sessionReady && !cancelled) {
        if (useDocTalkStore.getState().sessionId) return;
        try {
          const s = await createSession(documentId);
          if (cancelled) return;
          // An empty server session left unused is acceptable; replacing the
          // conversation the user opened from the menu meanwhile is not.
          if (useDocTalkStore.getState().sessionId) return;

          setSessionId(s.session_id);
          if (s.demo_messages_used != null) {
            // Fresh session, empty transcript — nothing restored yet, so the
            // baseline is 0 and every subsequent local user message counts.
            setDemoRestoredUserMsgCount(0);
            setDemoMessagesUsed(s.demo_messages_used);
            bumpDemoAccountingEpoch();
            writeDemoSession(documentId, s.session_id);
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
  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, setDemoRestoredUserMsgCount, bumpDemoAccountingEpoch, addSession]);

  return { sessionError };
}
