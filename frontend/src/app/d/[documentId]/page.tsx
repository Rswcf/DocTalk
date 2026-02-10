"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PdfViewer } from '../../../components/PdfViewer';
import TextViewer from '../../../components/TextViewer/TextViewer';
import { ChatPanel } from '../../../components/Chat';
import Header from '../../../components/Header';
import CustomInstructionsModal from '../../../components/CustomInstructionsModal';
import { listSessions, createSession, getDocument, getDocumentFileUrl, getMessages, updateDocumentInstructions, getUserProfile } from '../../../lib/api';
import { useDocTalkStore } from '../../../store';
import type { UserProfile } from '../../../types';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useLocale } from '../../../i18n';
import { sanitizeFilename } from '../../../lib/utils';
import { useWin98Theme } from '../../../components/win98/useWin98Theme';
import { Win98Window } from '../../../components/win98/Win98Window';
import { Win98Taskbar } from '../../../components/win98/Win98Taskbar';
import { ChatIcon, DocumentIcon, CreditIcon, GlobeIcon } from '../../../components/win98/Win98Icons';

export default function DocumentReaderPage() {
  const params = useParams<{ documentId: string }>();
  const documentId = params?.documentId as string;
  const router = useRouter();
  const { status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [fileType, setFileType] = useState<string>('pdf');
  const { t } = useLocale();
  const {
    pdfUrl,
    currentPage,
    highlights,
    highlightSnippet,
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
  const [showInstructions, setShowInstructions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const isWin98 = useWin98Theme();
  const totalPages = useDocTalkStore((s) => s.totalPages);
  const selectedMode = useDocTalkStore((s) => s.selectedMode);

  // Win98 splitter state
  const [splitterPos, setSplitterPos] = useState(45);
  const win98ContainerRef = useRef<HTMLDivElement>(null);
  const win98Dragging = useRef(false);

  const onWin98SplitterDown = useCallback(() => {
    win98Dragging.current = true;
  }, []);

  useEffect(() => {
    if (!isWin98) return;
    function onMouseMove(e: MouseEvent) {
      if (!win98Dragging.current || !win98ContainerRef.current) return;
      const rect = win98ContainerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitterPos(Math.max(20, Math.min(80, percent)));
    }
    function onMouseUp() {
      win98Dragging.current = false;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isWin98]);

  // Fetch profile for plan gating
  useEffect(() => {
    if (!isLoggedIn) return;
    getUserProfile().then(setProfile).catch(() => {});
  }, [isLoggedIn]);

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
        if (info.file_type) setFileType(info.file_type);
        if (info.filename) {
          const safeName = sanitizeFilename(info.filename);
          setDocumentName(safeName);
          setLastDocument(documentId, safeName);
        }
        if (info.status === 'error') {
          setError(info.error_msg || t('upload.error'));
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (info.status === 'ready') {
          if (info.summary) setDocumentSummary(info.summary);
          if (info.suggested_questions) setSuggestedQuestions(info.suggested_questions);
          if (info.custom_instructions !== undefined) setCustomInstructions(info.custom_instructions ?? null);
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

  const documentName = useDocTalkStore((s) => s.documentName);

  // Shared viewer content
  const viewerContent = fileType === 'pdf' ? (
    pdfUrl ? (
      <PdfViewer pdfUrl={pdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} scrollNonce={scrollNonce} />
    ) : (
      <div className="h-full w-full flex items-center justify-center text-zinc-500">{t('doc.loading')}</div>
    )
  ) : (
    <TextViewer documentId={documentId} fileType={fileType} targetPage={currentPage} scrollNonce={scrollNonce} highlightSnippet={highlightSnippet} />
  );

  const chatContent = documentStatus === 'ready' && sessionId ? (
    <ChatPanel sessionId={sessionId} onCitationClick={navigateToCitation} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} onOpenSettings={profile?.plan === 'pro' ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={profile?.plan || (isLoggedIn ? 'free' : undefined)} />
  ) : documentStatus !== 'ready' && !error ? (
    <div className={`h-full w-full flex flex-col items-center justify-center gap-3 ${isWin98 ? 'text-[var(--win98-dark-gray)] text-[11px]' : 'text-zinc-500'}`}>
      <div className={isWin98 ? 'text-[11px]' : 'animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 border-t-zinc-600'}>
        {isWin98 ? 'Loading...' : null}
      </div>
      <p className={isWin98 ? '' : 'text-sm'}>{t('doc.processing')}</p>
    </div>
  ) : (
    <div className={`h-full w-full flex items-center justify-center ${isWin98 ? 'text-[var(--win98-dark-gray)] text-[11px]' : 'text-zinc-500'}`}>{t('doc.initChat')}</div>
  );

  if (isWin98) {
    const taskbarItems = [
      {
        id: 'doctalk',
        title: `DocTalk - ${documentName || 'Document'}`,
        icon: <ChatIcon size={14} />,
        active: true,
      },
    ];

    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#008080' }}>
        {/* Desktop area */}
        <div className="flex-1 relative min-h-0">
          <div className="absolute inset-0" style={{ zIndex: 10 }}>
            <Win98Window
              title={`DocTalk - ${documentName || 'Document'}`}
              icon={<ChatIcon size={14} />}
              active={true}
              onMinimize={() => {}}
              onMaximize={() => {}}
              onClose={() => router.push('/')}
              menuItems={['File', 'Edit', 'View', 'Tools', 'Help']}
              className="w-full h-full"
              toolbar={
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[11px] shrink-0">Document:</span>
                  <div className="win98-inset flex-1 flex items-center bg-white h-[18px] px-1">
                    <DocumentIcon size={12} />
                    <span className="ml-1 text-[11px] truncate">
                      C:\My Documents\{documentName || 'document'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <CreditIcon size={14} />
                    <span className="text-[11px] font-bold">Credits</span>
                  </div>
                  <div className="win98-groove-v h-[14px]" />
                  <div className="flex items-center gap-1 shrink-0">
                    <GlobeIcon size={14} />
                    <span className="text-[11px]">EN</span>
                  </div>
                </div>
              }
              statusBar={
                <>
                  <div className="win98-statusbar-section flex-1">
                    <span className="text-[10px]">{documentStatus === 'ready' ? 'Ready' : 'Loading...'}</span>
                  </div>
                  <div className="win98-statusbar-section">
                    <span className="text-[10px]">Mode: {selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)}</span>
                  </div>
                  <div className="win98-statusbar-section">
                    <span className="text-[10px]">Pages: {totalPages || '...'}</span>
                  </div>
                </>
              }
            >
              {error ? (
                <div className="flex items-center justify-center h-full text-[12px]">
                  <div className="text-center">
                    <div className="font-bold mb-2">{error}</div>
                    <button className="win98-button" onClick={() => router.push('/')}>
                      {t('doc.backHome')}
                    </button>
                  </div>
                </div>
              ) : (
                <div ref={win98ContainerRef} className="flex h-full select-none">
                  {/* Left: Chat */}
                  <div style={{ width: `${splitterPos}%` }} className="min-w-0">
                    {chatContent}
                  </div>

                  {/* Win98 Splitter */}
                  <div
                    className="w-[4px] bg-[var(--win98-button-face)] cursor-col-resize shrink-0 flex items-center justify-center hover:bg-[var(--win98-light-gray)]"
                    onMouseDown={onWin98SplitterDown}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize panels"
                    style={{
                      borderLeft: '1px solid var(--win98-button-highlight)',
                      borderRight: '1px solid var(--win98-button-shadow)',
                    }}
                  >
                    <div className="flex flex-col gap-[2px]">
                      <div className="w-[2px] h-[2px] bg-[var(--win98-dark-gray)]" />
                      <div className="w-[2px] h-[2px] bg-[var(--win98-dark-gray)]" />
                      <div className="w-[2px] h-[2px] bg-[var(--win98-dark-gray)]" />
                    </div>
                  </div>

                  {/* Right: Viewer */}
                  <div style={{ width: `${100 - splitterPos}%` }} className="min-w-0">
                    {viewerContent}
                  </div>
                </div>
              )}
            </Win98Window>
          </div>
        </div>

        {/* Taskbar */}
        <Win98Taskbar items={taskbarItems} />

        <CustomInstructionsModal
          isOpen={showInstructions}
          onClose={() => setShowInstructions(false)}
          currentInstructions={customInstructions}
          onSave={async (instructions) => {
            await updateDocumentInstructions(documentId, instructions);
            setCustomInstructions(instructions);
          }}
        />
      </div>
    );
  }

  // Modern layout (light/dark)
  return (
    <div className="flex flex-col h-screen w-full">
      <Header isDemo={isDemo} isLoggedIn={isLoggedIn} />
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
            <div className="h-full min-w-0 sm:min-w-[320px] flex flex-col">
              <div className="flex-1 min-h-0">
                {chatContent}
              </div>
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
              {viewerContent}
            </div>
          </Panel>
        </Group>
      )}
      <CustomInstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        currentInstructions={customInstructions}
        onSave={async (instructions) => {
          await updateDocumentInstructions(documentId, instructions);
          setCustomInstructions(instructions);
        }}
      />
    </div>
  );
}
