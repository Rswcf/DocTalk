"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PdfViewer } from '../../../components/PdfViewer';
import { ChatPanel } from '../../../components/Chat';
import Header from '../../../components/Header';
import { listSessions, createSession, getDocument, getDocumentFileUrl, getMessages } from '../../../lib/api';
import { useDocTalkStore } from '../../../store';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useLocale } from '../../../i18n';

export default function DocumentReaderPage() {
  const params = useParams<{ documentId: string }>();
  const documentId = params?.documentId as string;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { t } = useLocale();
  const {
    pdfUrl,
    currentPage,
    highlights,
    scale,
    scrollNonce,
    setPdfUrl,
    setDocument,
    setDocumentName,
    setDocumentStatus,
    setSessionId,
    setSessions,
    addSession,
    setMessages,
    sessionId,
    navigateToCitation,
    setLastDocument,
  } = useDocTalkStore();

  useEffect(() => {
    if (!documentId) return;
    setDocument(documentId);
    (async () => {
      try {
        const info = await getDocument(documentId);
        setDocumentStatus(info.status);
        if (info.filename) {
          setDocumentName(info.filename);
          setLastDocument(documentId, info.filename);
        }
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.includes('HTTP 404')) {
          setError(t('doc.notFound'));
          return;
        }
        setError(t('doc.loadError'));
      }
      try {
        const file = await getDocumentFileUrl(documentId);
        setPdfUrl(file.url);
      } catch (e) {
        // 保持 PdfViewer 自身的错误提示
      }
      // Try to list existing sessions; fall back to creating a new one
      let sessionReady = false;
      try {
        const sessionsData = await listSessions(documentId);
        setSessions(sessionsData.sessions);
        if (sessionsData.sessions.length > 0) {
          const latest = sessionsData.sessions[0];
          setSessionId(latest.session_id);
          const msgsData = await getMessages(latest.session_id);
          setMessages(msgsData.messages);
          sessionReady = true;
        }
      } catch {
        // listSessions endpoint may not exist yet — fall through to create
      }
      if (!sessionReady) {
        try {
          const s = await createSession(documentId);
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
        } catch {
          // session creation failed — ChatPanel will show init message
        }
      }
    })();
  }, [documentId, setDocument, setDocumentName, setDocumentStatus, setLastDocument, setPdfUrl, setSessionId, setSessions, addSession, setMessages, t]);

  return (
    <div className="flex flex-col h-screen w-full">
      <Header />
      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-3">{error}</div>
            <button
              className="px-4 py-2 bg-gray-900 text-white rounded dark:bg-gray-100 dark:text-gray-900"
              onClick={() => router.push('/')}
            >
              {t('doc.backHome')}
            </button>
          </div>
        </div>
      ) : (
        <Group orientation="horizontal" className="flex-1 min-h-0">
          <Panel defaultSize={50} minSize={25}>
            <div className="h-full min-w-[320px]">
              {sessionId ? (
                <ChatPanel sessionId={sessionId} onCitationClick={navigateToCitation} />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-500">{t('doc.initChat')}</div>
              )}
            </div>
          </Panel>

          <Separator
            className="w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors cursor-col-resize flex items-center justify-center"
            aria-label="Resize panels"
          >
            <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 rounded-full" />
          </Separator>

          <Panel defaultSize={50} minSize={35}>
            <div className="h-full">
              {pdfUrl ? (
                <PdfViewer pdfUrl={pdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} scrollNonce={scrollNonce} />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-500">{t('doc.loading')}</div>
              )}
            </div>
          </Panel>
        </Group>
      )}
    </div>
  );
}
