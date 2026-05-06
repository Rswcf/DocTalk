"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FileText, MessageSquare, Plus, X } from 'lucide-react';
import Header from '../../../components/Header';
import { ChatPanel } from '../../../components/Chat';
import CollectionSidebar from '../../../components/Collections/CollectionSidebar';
import SessionList from '../../../components/Collections/SessionList';
import {
  getCollection,
  getMessages,
  createCollectionSession,
  listCollectionSessions,
  addDocumentsToCollection,
  getMyDocuments,
} from '../../../lib/api';
import type { DocumentBrief } from '../../../lib/api';
import { useDocTalkStore } from '../../../store';
import { useLocale } from '../../../i18n';
import { useUserPlanProfile } from '../../../lib/useUserPlanProfile';
import type { Citation, CollectionDetail, SessionItem } from '../../../types';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { trackEvent } from '../../../lib/analytics';

export default function CollectionDetailPage() {
  const params = useParams<{ collectionId: string }>();
  const collectionId = params?.collectionId as string;
  const router = useRouter();
  const { status } = useSession();
  const { t, tOr } = useLocale();
  const { userPlan } = useUserPlanProfile();
  const {
    sessionId,
    setSessionId,
    setMessages,
    sessions,
    setSessions,
    addSession,
  } = useDocTalkStore();

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDocs, setShowAddDocs] = useState(false);
  const [availableDocs, setAvailableDocs] = useState<DocumentBrief[]>([]);
  // Mobile sidebar toggle
  const [showMobileSidebar, setShowMobileSidebar] = useState<'docs' | 'sessions' | null>(null);

  // Load collection detail
  useEffect(() => {
    if (!collectionId || status !== 'authenticated') return;
    let cancelled = false;

    (async () => {
      try {
        const coll = await getCollection(collectionId);
        if (!cancelled) setCollection(coll);
      } catch {
        if (!cancelled) router.push('/collections');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [collectionId, status, router]);

  // Setup session for collection
  useEffect(() => {
    if (!collectionId || !collection) return;
    let cancelled = false;

    (async () => {
      let sessionReady = false;
      try {
        const sessionsData = await listCollectionSessions(collectionId);
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
        console.error('Failed to load collection sessions:', e);
      }
      if (!sessionReady && !cancelled) {
        try {
          const s = await createCollectionSession(collectionId);
          if (cancelled) return;
          setSessionId(s.session_id);
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
          console.error('Failed to create collection session:', e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [collectionId, collection, setSessions, setSessionId, setMessages, addSession]);

  const handleSelectSession = useCallback(async (sid: string) => {
    setSessionId(sid);
    setShowMobileSidebar(null);
    try {
      const msgsData = await getMessages(sid);
      setMessages(msgsData.messages);
    } catch (e) {
      console.error('Failed to load session messages:', e);
    }
  }, [setSessionId, setMessages]);

  const handleNewSession = useCallback(async () => {
    try {
      const s = await createCollectionSession(collectionId);
      setSessionId(s.session_id);
      const now = s.created_at || new Date().toISOString();
      addSession({
        session_id: s.session_id,
        title: null,
        message_count: 0,
        created_at: now,
        last_activity_at: now,
      });
      setMessages([]);
      setShowMobileSidebar(null);
    } catch (e) {
      console.error('Failed to create new session:', e);
    }
  }, [collectionId, setSessionId, addSession, setMessages]);

  const handleAddDocs = async () => {
    const docs = await getMyDocuments();
    const existingIds = new Set((collection?.documents || []).map(d => d.id));
    setAvailableDocs(docs.filter(d => d.status === 'ready' && !existingIds.has(d.id)));
    setShowAddDocs(true);
  };

  const handleAddDocument = async (docId: string) => {
    await addDocumentsToCollection(collectionId, [docId]);
    const coll = await getCollection(collectionId);
    setCollection(coll);
    setShowAddDocs(false);
  };

  const handleOpenDoc = (docId: string) => {
    window.open(`/d/${docId}`, '_blank');
  };

  const handleCitationClick = useCallback((citation: Citation) => {
    if (!citation.documentId) return;
    trackEvent('citation_clicked', {
      source: 'collection_reader',
      page: citation.page,
      has_bboxes: Boolean(citation.bboxes?.length),
    });
    const params = new URLSearchParams({
      page: String(citation.page || 1),
    });
    if (citation.chunkId) params.set('highlight', citation.chunkId);
    window.open(`/d/${citation.documentId}?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }, []);

  if (status === 'loading' || loading) {
    return <LoadingScreen label={t('common.loading')} />;
  }

  if (status !== 'authenticated') {
    router.push('/auth?callbackUrl=/collections');
    return null;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--page-background)]">
      <Header variant="full" />

      <div className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {tOr('collections.workspace', 'Collection workspace')}
            </p>
            <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {collection?.name || t('collections.title')}
            </h1>
          </div>
          <div className="hidden items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:flex">
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-950">
              <FileText aria-hidden="true" size={13} className="text-accent" />
              {collection?.documents?.length || 0} {tOr('collections.documents', 'documents')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-950">
              <MessageSquare aria-hidden="true" size={13} className="text-accent" />
              {sessions.length} {tOr('collections.chats', 'chats')}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile toggle bar */}
      <div className="flex border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
        <button
          type="button"
          onClick={() => setShowMobileSidebar(showMobileSidebar === 'docs' ? null : 'docs')}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
            showMobileSidebar === 'docs' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500'
          }`}
        >
          <FileText aria-hidden="true" size={14} />
          {tOr('collections.documents', 'Documents')} ({collection?.documents?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setShowMobileSidebar(showMobileSidebar === 'sessions' ? null : 'sessions')}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
            showMobileSidebar === 'sessions' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500'
          }`}
        >
          <MessageSquare aria-hidden="true" size={14} />
          {tOr('collections.sessions', 'Sessions')} ({sessions.length})
        </button>
      </div>

      {/* Mobile sidebar content */}
      {showMobileSidebar && (
        <div className="max-h-72 overflow-y-auto border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          {showMobileSidebar === 'docs' && (
            <CollectionSidebar
              documents={collection?.documents || []}
              onAddDocs={handleAddDocs}
              onOpenDoc={handleOpenDoc}
            />
          )}
          {showMobileSidebar === 'sessions' && (
            <SessionList
              sessions={sessions}
              activeSessionId={sessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
            />
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Desktop left sidebar: Documents + Sessions */}
        <div className="hidden w-72 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {collection?.name || ''}
            </h2>
            {collection?.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{collection.description}</p>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {/* Documents section */}
            <div className="min-h-0 flex-1 border-b border-zinc-200 dark:border-zinc-800">
              <CollectionSidebar
                documents={collection?.documents || []}
                onAddDocs={handleAddDocs}
                onOpenDoc={handleOpenDoc}
              />
            </div>

            {/* Sessions section */}
            <div className="flex-1 min-h-0">
              <SessionList
                sessions={sessions}
                activeSessionId={sessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
              />
            </div>
          </div>
        </div>

        {/* Main: Chat Panel */}
        <div className="min-w-0 flex-1 bg-white dark:bg-zinc-950">
          {sessionId ? (
            <ChatPanel
              sessionId={sessionId}
              onCitationClick={handleCitationClick}
              userPlan={userPlan}
              supportsCustomInstructions={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-zinc-500">
              <div>
                <MessageSquare aria-hidden="true" size={32} className="mx-auto mb-3 text-zinc-400" />
                <p className="text-sm">{t('doc.initChat')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add documents modal */}
      {showAddDocs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overscroll-contain"
          onClick={() => setShowAddDocs(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowAddDocs(false); }}
        >
          <div
            className="mx-4 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-docs-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="add-docs-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('collections.addDocuments')}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {tOr('collections.addDocumentsHint', 'Only ready documents that are not already in this collection are shown.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDocs(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400"
                aria-label={t('common.close')}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            {availableDocs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-950">
                <FileText aria-hidden="true" size={26} className="mx-auto mb-3 text-zinc-400" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {tOr('collections.noAvailableDocuments', 'No ready documents are available to add.')}
                </p>
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {availableDocs.map(d => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => handleAddDocument(d.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  >
                    <FileText aria-hidden="true" size={16} className="shrink-0 text-accent" />
                    <span className="min-w-0 truncate text-sm text-zinc-800 dark:text-zinc-200">{d.filename}</span>
                    <Plus aria-hidden="true" size={14} className="ml-auto shrink-0 text-zinc-400" />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAddDocs(false)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
