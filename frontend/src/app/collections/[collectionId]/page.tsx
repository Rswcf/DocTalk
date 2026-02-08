"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, X, FileText } from 'lucide-react';
import Header from '../../../components/Header';
import { ChatPanel } from '../../../components/Chat';
import {
  getCollection,
  getMessages,
  createCollectionSession,
  listCollectionSessions,
  addDocumentsToCollection,
  removeDocumentFromCollection,
  getMyDocuments,
} from '../../../lib/api';
import type { DocumentBrief } from '../../../lib/api';
import { useDocTalkStore } from '../../../store';
import { useLocale } from '../../../i18n';
import type { CollectionDetail, CollectionDocumentBrief } from '../../../types';

export default function CollectionDetailPage() {
  const params = useParams<{ collectionId: string }>();
  const collectionId = params?.collectionId as string;
  const router = useRouter();
  const { status } = useSession();
  const { t } = useLocale();
  const {
    sessionId,
    setSessionId,
    setMessages,
    setSessions,
    addSession,
    navigateToCitation,
  } = useDocTalkStore();

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDocs, setShowAddDocs] = useState(false);
  const [availableDocs, setAvailableDocs] = useState<DocumentBrief[]>([]);

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
      } catch {}
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
        } catch {}
      }
    })();

    return () => { cancelled = true; };
  }, [collectionId, collection]);

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

  const handleRemoveDocument = async (docId: string) => {
    await removeDocumentFromCollection(collectionId, docId);
    setCollection(prev => prev ? {
      ...prev,
      documents: prev.documents.filter(d => d.id !== docId),
    } : null);
  };

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
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat Panel */}
        <div className="flex-1 min-w-0">
          {sessionId ? (
            <ChatPanel
              sessionId={sessionId}
              onCitationClick={navigateToCitation}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500">
              {t('doc.initChat')}
            </div>
          )}
        </div>

        {/* Right: Document list sidebar */}
        <div className="w-72 border-l border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {collection?.name || ''}
            </h2>
            {collection?.description && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{collection.description}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(collection?.documents || []).map((doc: CollectionDocumentBrief) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700"
              >
                <FileText size={14} className="text-zinc-400 shrink-0" />
                <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate flex-1">
                  {doc.filename}
                </span>
                <button
                  onClick={() => handleRemoveDocument(doc.id)}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 transition-colors"
                  title={t('collections.removeDocument')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleAddDocs}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus size={14} />
              {t('collections.addDocuments')}
            </button>
          </div>
        </div>
      </div>

      {/* Add documents modal */}
      {showAddDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddDocs(false)}>
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
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
                    className="w-full text-left p-3 rounded-lg border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">{d.filename}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAddDocs(false)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
