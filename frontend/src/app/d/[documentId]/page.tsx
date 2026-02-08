"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  const { status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
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
    setDocumentSummary,
    setSuggestedQuestions,
  } = useDocTalkStore();

  const suggestedQuestions = useDocTalkStore((s) => s.suggestedQuestions);

  const documentStatus = useDocTalkStore((s) => s.documentStatus);

  // Effect 1: Initial load + polling until ready/error
  useEffect(() => {
    if (!documentId) return;
    setDocument(documentId);

    let intervalId: NodeJS.Timeout | null = null;
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const info = await getDocument(documentId);
        if (cancelled) return;
        setDocumentStatus(info.status);
        if (info.is_demo) setIsDemo(true);
        if (info.filename) {
          setDocumentName(info.filename);
          setLastDocument(documentId, info.filename);
        }
        if (info.status === 'error') {
          setError(info.error_msg || t('upload.error'));
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (info.status === 'ready') {
          if (info.summary) setDocumentSummary(info.summary);
          if (info.suggested_questions) setSuggestedQuestions(info.suggested_questions);
          if (intervalId) clearInterval(intervalId);
          return;
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.message || e || '');
        if (msg.includes('HTTP 404')) {
          setError(t('doc.notFound'));
        } else {
          setError(t('doc.loadError'));
        }
        if (intervalId) clearInterval(intervalId);
      }
    };

    // Fetch PDF file URL immediately (independent of status)
    (async () => {
      try {
        const file = await getDocumentFileUrl(documentId);
        if (!cancelled) setPdfUrl(file.url);
      } catch {
        // PdfViewer shows its own error
      }
    })();

    // Initial fetch + start polling
    fetchStatus();
    intervalId = setInterval(fetchStatus, 3000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [documentId]);

  // Effect 2: Session setup when document is ready
  useEffect(() => {
    if (!documentId || documentStatus !== 'ready') return;

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
      } catch {
        // listSessions endpoint may not exist yet — fall through to create
      }
      if (!sessionReady && !cancelled) {
        try {
          const s = await createSession(documentId);
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
          // Inject synthetic summary message if available
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
        } catch {
          // session creation failed — ChatPanel will show init message
        }
      }
    })();

    return () => { cancelled = true; };
  }, [documentId, documentStatus]);

  return (
    <div className="flex flex-col h-screen w-full">
      <Header />
      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-3">{error}</div>
            <button
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors"
              onClick={() => router.push('/')}
            >
              {t('doc.backHome')}
            </button>
          </div>
        </div>
      ) : (
        <Group orientation="horizontal" className="flex-1 min-h-0">
          <Panel defaultSize={50} minSize={25}>
            <div className="h-full min-w-0 sm:min-w-[320px]">
              {documentStatus === 'ready' && sessionId ? (
                <ChatPanel sessionId={sessionId} onCitationClick={navigateToCitation} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} />
              ) : documentStatus !== 'ready' && !error ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-zinc-500 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 border-t-zinc-600" />
                  <p className="text-sm">{t('doc.processing')}</p>
                </div>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-zinc-500">{t('doc.initChat')}</div>
              )}
            </div>
          </Panel>

          <Separator
            className="w-3 sm:w-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center"
            aria-label="Resize panels"
          >
            <div className="w-0.5 h-8 bg-zinc-400 dark:bg-zinc-500 rounded-full" />
          </Separator>

          <Panel defaultSize={50} minSize={35}>
            <div className="h-full">
              {pdfUrl ? (
                <PdfViewer pdfUrl={pdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} scrollNonce={scrollNonce} />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-zinc-500">{t('doc.loading')}</div>
              )}
            </div>
          </Panel>
        </Group>
      )}
    </div>
  );
}
