"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, Home, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { createSession, getMessages, deleteSession } from '../lib/api';
import { errorCopy, type ErrorCopy } from '../lib/errorCopy';
import { trackEvent } from '../lib/analytics';
import { getBillingErrorMessage, startPlanAwareBillingAction } from '../lib/billing';
import { useDropdownKeyboard } from '../lib/useDropdownKeyboard';
import { clearDemoSession, readDemoSession, writeDemoSession } from '../lib/demoSessionStorage';
import { useUserProfile } from '../lib/useUserProfile';
import { acquireSingleFlight, type SingleFlightLatch } from '../lib/singleFlight';

export default function SessionDropdown() {
  const documentName = useDocTalkStore((s) => s.documentName);
  const documentId = useDocTalkStore((s) => s.documentId);
  const isDemo = useDocTalkStore((s) => s.isDemo);
  const sessionId = useDocTalkStore((s) => s.sessionId);
  const sessions = useDocTalkStore((s) => s.sessions);
  const isStreaming = useDocTalkStore((s) => s.isStreaming);

  const { addSession, setSessionId, restoreSession, setMessages, removeSession, reset, setDemoMessagesUsed, setDemoRestoredUserMsgCount, bumpDemoAccountingEpoch, setStreaming, flushPendingText } = useDocTalkStore();
  const { t, tOr } = useLocale();
  const router = useRouter();
  const { status } = useSession();
  const { profile } = useUserProfile();

  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sessionErrorCopy, setSessionErrorCopy] = useState<ErrorCopy | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const menuActionLatchRef = useRef<{ documentId: string | null; latch: SingleFlightLatch }>({ documentId: null, latch: { current: false } });

  useEffect(() => {
    setSessionErrorCopy(null);
    setConfirmDeleteId(null);
  }, [documentId, isDemo]);

  useEffect(() => {
    if (confirmDeleteId) deleteConfirmRef.current?.focus();
  }, [confirmDeleteId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setFocusIndex(0);
    } else {
      setConfirmDeleteId(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const toggle = () => setOpen((v) => !v);

  // Session-menu actions (open, New Chat, delete) run one at a time, and
  // never while an answer is streaming: each one awaits the network before it
  // publishes a session, so two in flight could resume over each other (a
  // late switch overwriting a New Chat, or opening a conversation that is
  // being deleted). Clicks during a pending action are ignored.
  // The latch belongs to one document. The header keeps this menu mounted
  // across documents, and a request stalled on the previous one (the proxy
  // gives up only after 30 s) must not lock the menu here; its late result is
  // dropped by the document checks in the actions themselves.
  const runMenuAction = async (action: () => Promise<void>) => {
    const liveDocumentId = useDocTalkStore.getState().documentId;
    if (menuActionLatchRef.current.documentId !== liveDocumentId) {
      menuActionLatchRef.current = { documentId: liveDocumentId, latch: { current: false } };
    }
    const release = acquireSingleFlight(
      menuActionLatchRef.current.latch,
      () => useDocTalkStore.getState().isStreaming,
    );
    if (!release) return;
    try {
      await action();
    } finally {
      release();
    }
  };

  const startNewChat = async () => {
    const live = useDocTalkStore.getState();
    if (!documentId || live.documentId !== documentId || live.documentStatus !== 'ready' || live.isStreaming) return;
    setSessionErrorCopy(null);
    const selectionEpoch = live.domainModeEpoch;
    try {
      const s = await createSession(documentId);
      if (useDocTalkStore.getState().documentId !== documentId) return;
      addSession({
        session_id: s.session_id,
        title: null,
        domain_mode: null,
        message_count: 0,
        created_at: s.created_at,
        last_activity_at: s.created_at,
      });
      // Same rule as openSession: a send on the conversation still on screen
      // supersedes this New Chat. Publishing now would orphan that stream.
      // The new conversation exists on the server (and counts toward the
      // session cap), so it stays listed, but it is not opened.
      if (useDocTalkStore.getState().isStreaming) return;
      restoreSession(s.session_id, [], null, selectionEpoch);
      if (s.demo_messages_used != null) {
        // Fresh session, empty transcript — same contract as useChatSession's
        // createSession path: baseline 0, every message sent from here counts.
        setDemoRestoredUserMsgCount(0);
        setDemoMessagesUsed(s.demo_messages_used);
        // This install is itself an accounting-relevant event — bump so a
        // pending reanchorDemoCounter GET from before this "New Chat" (e.g.
        // a failed regenerate on whatever session was active) can't clobber
        // it (Codex r5: relying on the sessionId change alone was judged
        // fragile enough to bump unconditionally here too).
        bumpDemoAccountingEpoch();
        // "New Chat" for an anon demo user starts a NEW session — the stored
        // pointer must move to it, or the next page view re-adopts the old
        // (now-abandoned) session instead of this one.
        writeDemoSession(documentId, s.session_id);
      }
      setMessages([]);
      setConfirmDeleteId(null);
      setOpen(false);
    } catch (e) {
      if (useDocTalkStore.getState().documentId !== documentId) return;
      // Use THIS request's validated snapshot, not a live re-read: on a return to
      // the same document before its metadata lands, `isDemo` is briefly false, and a
      // live read renders own-document copy (with an Upgrade button) for a DEMO cap —
      // the §9.19 defect in a transition window. The limit_hit below already uses the
      // snapshot; this keeps the copy consistent with the event (Codex r3 note).
      const copy = errorCopy(e, t, tOr, { isDemo: live.isDemo });
      setSessionErrorCopy(copy);
      if (copy.cta) {
        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit', document_id: documentId, is_demo: live.isDemo });
      }
    }
  };

  const onNewChat = () => runMenuAction(startNewChat);

  const openSession = async (id: string) => {
    setSessionErrorCopy(null);
    const selectionEpoch = useDocTalkStore.getState().domainModeEpoch;
    // Fetch the transcript BEFORE publishing the new session id, and publish
    // both in one synchronous run (same rule as useChatSession). ChatPanel
    // reads "session id set, empty transcript" as a fresh session, so a demo
    // `?question=` link auto-submits into it, and a transcript that lands
    // after that send replaces the local question/answer pair: the streamed
    // answer is then appended to whatever message is last (2026-10-10).
    // Until the fetch resolves, the previous conversation stays on screen
    // under its own id.
    const msgs = await getMessages(id);
    const live = useDocTalkStore.getState();
    // Other menu actions wait for this one, but a document change or a send
    // on the conversation still on screen can happen meanwhile and
    // supersedes this switch. Publishing over a running stream would orphan
    // it: its writes stop at the session-id check and nothing clears
    // isStreaming.
    if (live.documentId !== documentId || live.isStreaming) return;
    restoreSession(id, msgs.messages, live.sessions.find(row => row.session_id === id)?.domain_mode, selectionEpoch);
    // Same restore contract as useChatSession's reuse branch: switching to a
    // session with a real transcript must reset the baseline to what THIS
    // transcript carries, or the demo counter stays misaligned against the
    // newly-loaded messages (only relevant when `id` is an anon demo session
    // — demo_messages_used is absent for authed/non-demo sessions).
    if (msgs.demo_messages_used != null) {
      const restoredUserMsgCount = msgs.messages.filter((m) => m.role === 'user').length;
      setDemoRestoredUserMsgCount(restoredUserMsgCount);
      setDemoMessagesUsed(msgs.demo_messages_used);
      // This install is itself an accounting-relevant event — bump so a
      // pending reanchorDemoCounter GET can't clobber it. Required (not
      // just defensive) here specifically: the current session row stays
      // clickable, so an A→A "switch" — or A→B→A — can install fresh
      // accounting without ever changing sessionId, which the existing
      // sessionId guard alone cannot detect (Codex r5).
      bumpDemoAccountingEpoch();
      // Switching to a different anon-demo session moves the "active"
      // session — move the pointer too, so the next page view re-adopts
      // the one the user actually switched to, not the one they left.
      if (documentId) writeDemoSession(documentId, id);
    }
    setConfirmDeleteId(null);
    setOpen(false);
  };

  const onSwitchSession = (id: string) => runMenuAction(() => openSession(id));

  const deleteSessionById = async (targetId: string) => {
    setSessionErrorCopy(null);
    setConfirmDeleteId(null);
    await deleteSession(targetId);
    // Clear the stored anon-demo pointer IMMEDIATELY on confirmed delete, if
    // it named this session — before any replacement GET below. Otherwise a
    // transient failure in onSwitchSession/onNewChat would leave the
    // pointer naming a session that no longer exists (Codex r2 #3): the
    // next page load would 404 on adopt, which is a safe fallback, but only
    // clearing it here proactively avoids that extra failed round-trip. A
    // successful switch/create afterward writes the new pointer over this.
    if (documentId && readDemoSession(documentId) === targetId) {
      clearDemoSession(documentId);
    }
    // The pointer above belongs to the deleted row's document. Everything
    // below acts on the live store and menu, which may belong to another
    // document by now (the latch is per document): leave them alone.
    if (useDocTalkStore.getState().documentId !== documentId) return;
    removeSession(targetId);
    const live = useDocTalkStore.getState();
    const remaining = live.sessions;
    if (live.sessionId === targetId) {
      // The open conversation is gone: take it off screen before its
      // replacement loads, so nothing can be sent into it meanwhile. The
      // reader shows its "initializing chat" placeholder until then; if the
      // replacement cannot load, this menu stays open to pick another one.
      // A send on it during the delete request streams into a conversation
      // the server no longer has. Unpublishing drops the rest of that stream
      // (useChatStream's session check), its `done` included, so nothing
      // would clear isStreaming and the replacement would refuse to load.
      // End it here first. Nothing aborts its request: it runs to completion
      // in the background and every callback is dropped.
      if (live.isStreaming) {
        flushPendingText();
        setStreaming(false);
      }
      setSessionId(null);
      setMessages([]);
      if (remaining.length > 0) {
        await openSession(remaining[0].session_id);
      } else {
        await startNewChat();
      }
      // The replacement load is a second await: same check as above.
      if (useDocTalkStore.getState().documentId !== documentId) return;
    }
    setOpen(false);
  };

  const onDeleteSessionById = (targetId: string) => runMenuAction(() => deleteSessionById(targetId));

  const onDeleteCurrent = () => {
    if (!sessionId || isStreaming) return;
    setSessionErrorCopy(null);
    setConfirmDeleteId(sessionId);
  };

  const requestDeleteSession = (targetId: string) => {
    if (isStreaming) return;
    setSessionErrorCopy(null);
    setConfirmDeleteId(targetId);
  };

  const onBackHome = () => {
    router.push('/');
    reset();
  };

  const onUpgrade = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      await startPlanAwareBillingAction({
        plan: 'plus',
        billing: 'monthly',
        source: 'session_dropdown',
        reason: 'session_limit',
        currentPlan: profile?.plan,
      });
    } catch (error) {
      const message = getBillingErrorMessage(error, t('billing.error'));
      setSessionErrorCopy({ title: t('billing.error'), body: message, severity: 'error' });
      setCheckoutLoading(false);
    }
  };

  const disabledClass = isStreaming ? 'opacity-60 cursor-not-allowed' : '';

  const titleText = documentName || '';
  const sortedSessions = useMemo(() => sessions.slice(0, 10), [sessions]);

  // Total items: 1 (New Chat) + sessions + 1 (Delete) + 1 (Back Home)
  const totalItems = 1 + sortedSessions.length + 2;

  const handleMenuSelect = (index: number) => {
    if (index === 0) {
      void onNewChat();
      return;
    }
    if (index >= 1 && index <= sortedSessions.length) {
      const selected = sortedSessions[index - 1];
      if (selected) void onSwitchSession(selected.session_id);
      return;
    }
    if (index === 1 + sortedSessions.length) {
      onDeleteCurrent();
      return;
    }
    if (index === 2 + sortedSessions.length) {
      onBackHome();
    }
  };

  const handleMenuKeyDown = useDropdownKeyboard(
    totalItems,
    focusIndex,
    setFocusIndex,
    handleMenuSelect,
    () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
  );

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        data-tour="session-dropdown"
        className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors max-w-[72px] min-[375px]:max-w-[112px] sm:max-w-[200px] md:max-w-[300px] truncate flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
        title={titleText}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{titleText}</span>
        <ChevronDown aria-hidden="true" size={14} className="opacity-70" />
      </button>
      {open && (
        <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:start-0 mt-1 w-auto sm:w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 p-1" onKeyDown={handleMenuKeyDown} role="menu">
          <div className="py-1">
            <button
              ref={(el) => { itemRefs.current[0] = el; }}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${disabledClass}`}
              onClick={onNewChat}
              disabled={isStreaming}
              tabIndex={focusIndex === 0 ? 0 : -1}
              role="menuitem"
            >
              <Plus aria-hidden="true" size={16} />
              <span>{t('session.newChat')}</span>
            </button>
            {sessionErrorCopy && (
              <div
                role="alert"
                onKeyDown={(event) => {
                  // Let native CTA activation run instead of the menu's New Chat handler.
                  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                }}
                className={`mx-1 mt-2 rounded-lg border px-3 py-2 text-xs ${
                  sessionErrorCopy.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
                }`}
              >
                <p className="font-medium">{sessionErrorCopy.title}</p>
                <p className="mt-1 leading-5 opacity-90">{sessionErrorCopy.body}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {sessionErrorCopy.secondaryAction?.action === 'delete_session' && (
                    <button
                      type="button"
                      disabled={isStreaming}
                      onClick={() => {
                        const target = sessions.find((s) => s.session_id !== sessionId)?.session_id ?? sessionId;
                        if (target) requestDeleteSession(target);
                      }}
                      className="mt-2 rounded-md border border-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-500 dark:text-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400"
                    >
                      {sessionErrorCopy.secondaryAction.label}
                    </button>
                  )}
                  {sessionErrorCopy.cta && (
                    status === 'authenticated' && sessionErrorCopy.cta.plan ? (
                      <button
                        type="button"
                        onClick={onUpgrade}
                        disabled={checkoutLoading}
                        className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                      >
                        {sessionErrorCopy.cta.label}
                      </button>
                    ) : (
                      <Link
                        href={sessionErrorCopy.cta.href}
                        className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                      >
                        {sessionErrorCopy.cta.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t('session.recentChats')}
          </div>
          <div className="max-h-64 overflow-auto">
            {sortedSessions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">{t('session.noTitle')}</div>
            ) : (
              sortedSessions.map((s, i) => {
                const isCurrent = s.session_id === sessionId;
                const label = s.title?.trim() || t('session.noTitle');
                const idx = 1 + i;
                return (
                  <div
                    key={s.session_id}
                    className={`group flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                      isCurrent ? 'font-medium' : ''
                    }`}
                  >
                    <button
                      ref={(el) => { itemRefs.current[idx] = el; }}
                      className={`flex-1 min-w-0 text-left flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset rounded ${disabledClass}`}
                      onClick={() => onSwitchSession(s.session_id)}
                      disabled={isStreaming}
                      tabIndex={focusIndex === idx ? 0 : -1}
                      role="menuitem"
                    >
                      <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {isCurrent ? <span className="block w-2 h-2 rounded-full bg-zinc-600" aria-label="Current session" /> : null}
                      </span>
                      <span className="flex-1 truncate" title={label}>{label}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                        {t('session.messageCount', { count: s.message_count })}
                      </span>
                    </button>
                    {confirmDeleteId === s.session_id && s.session_id !== sessionId ? (
                      <div
                        className="shrink-0 mr-1 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                        }}
                      >
                        <span>{t('dashboard.deletePrompt')}</span>
                        <button
                          ref={deleteConfirmRef}
                          className="px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
                          onClick={(e) => { e.stopPropagation(); onDeleteSessionById(s.session_id); }}
                          disabled={isStreaming}
                          tabIndex={-1}
                        >
                          {t('common.yes')}
                        </button>
                        <button
                          className="px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          disabled={isStreaming}
                          tabIndex={-1}
                        >
                          {t('common.no')}
                        </button>
                      </div>
                    ) : (
                      <button
                        className={`shrink-0 p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-zinc-400 ${disabledClass}`}
                        onClick={(e) => { e.stopPropagation(); requestDeleteSession(s.session_id); }}
                        disabled={isStreaming}
                        title={t('session.deleteChat')}
                        aria-label={t('session.deleteChat')}
                        tabIndex={-1}
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="py-1">
            <button
              ref={(el) => { itemRefs.current[1 + sortedSessions.length] = el; }}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-red-600 dark:text-red-400 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${disabledClass}`}
              onClick={onDeleteCurrent}
              disabled={isStreaming}
              tabIndex={focusIndex === 1 + sortedSessions.length ? 0 : -1}
              role="menuitem"
            >
              <Trash2 aria-hidden="true" size={16} />
              <span>{t('session.deleteChat')}</span>
            </button>
            {sessionId && confirmDeleteId === sessionId && (
              <div
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                }}
              >
                <span>{t('dashboard.deletePrompt')}</span>
                <button
                  ref={deleteConfirmRef}
                  className="px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
                  onClick={() => onDeleteSessionById(sessionId)}
                  disabled={isStreaming}
                >
                  {t('common.yes')}
                </button>
                <button
                  className="px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={isStreaming}
                >
                  {t('common.no')}
                </button>
              </div>
            )}
            <button
              ref={(el) => { itemRefs.current[2 + sortedSessions.length] = el; }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
              onClick={onBackHome}
              tabIndex={focusIndex === 2 + sortedSessions.length ? 0 : -1}
              role="menuitem"
            >
              <Home aria-hidden="true" size={16} />
              <span>{t('session.backHome')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
