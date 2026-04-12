"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
import type { CollectionDetail, SessionItem } from '../../../types';

export default function CollectionDetailPage() {
  const params = useParams<{ collectionId: string }>();
  const collectionId = params?.collectionId as string;
  const router = useRouter();
  const { status } = useSession();
  const { t } = useLocale();
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
  }, [collectionId, status]);

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
  }, [collectionId, collection]);

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

  // Citation click in collection context — no PDF viewer, just log
  const handleCitationClick = useCallback(() => {
    // In collection view, citations are handled by CollectionCitationCard (expandable)
    // No PDF navigation needed here
  }, []);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">{t('common.loading')}</div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    router.push('/auth?callbackUrl=/collections');
    return null;
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <Header variant="full" />

      {/* Mobile toggle bar */}
      <div className="flex md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <button
          onClick={() => setShowMobileSidebar(showMobileSidebar === 'docs' ? null : 'docs')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            showMobileSidebar === 'docs' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'
          }`}
        >
          Docs ({collection?.documents?.length || 0})
        </button>
        <button
          onClick={() => setShowMobileSidebar(showMobileSidebar === 'sessions' ? null : 'sessions')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            showMobileSidebar === 'sessions' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'
          }`}
        >
          Sessions ({sessions.length})
        </button>
      </div>

      {/* Mobile sidebar content */}
      {showMobileSidebar && (
        <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 max-h-60 overflow-y-auto bg-zinc-50 dark:bg-zinc-900">
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

      <div className="flex-1 flex min-h-0">
        {/* Desktop left sidebar: Documents + Sessions */}
        <div className="hidden md:flex w-64 border-r border-zinc-200 dark:border-zinc-800 flex-col bg-zinc-50 dark:bg-zinc-900">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {collection?.name || ''}
            </h2>
            {collection?.description && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{collection.description}</p>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Documents section */}
            <div className="flex-1 min-h-0 border-b border-zinc-200 dark:border-zinc-800">
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
        <div className="flex-1 min-w-0">
          {sessionId ? (
            <ChatPanel
              sessionId={sessionId}
              onCitationClick={handleCitationClick}
              userPlan={userPlan}
              supportsCustomInstructions={false}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500">
              {t('doc.initChat')}
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
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-docs-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-docs-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('collections.addDocuments')}
            </h3>
            {availableDocs.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('collections.noCollections')}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableDocs.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleAddDocument(d.id)}
                    className="w-full text-left p-3 rounded-lg border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                  >
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">{d.filename}</span>
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
