"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PdfViewer } from '../../../components/PdfViewer';
import TextViewer from '../../../components/TextViewer/TextViewer';
import { ChatPanel } from '../../../components/Chat';
import Header from '../../../components/Header';
import CustomInstructionsModal from '../../../components/CustomInstructionsModal';
import { getChunkDetail, updateDocumentInstructions } from '../../../lib/api';
import { useDocTalkStore } from '../../../store';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useLocale } from '../../../i18n';
import { usePageTitle } from '../../../lib/usePageTitle';
import { Presentation, FileText, MessageSquare } from 'lucide-react';
import { useDocumentLoader } from '../../../lib/useDocumentLoader';
import { useChatSession } from '../../../lib/useChatSession';
import { useUserPlanProfile } from '../../../lib/useUserPlanProfile';
import type { Citation } from '../../../types';
import { shouldShowTour, startOnboardingTour } from '../../../lib/onboarding';
import { trackEvent } from '../../../lib/analytics';

export default function DocumentReaderPageClient() {
  const params = useParams<{ documentId: string }>();
  const documentId = params?.documentId as string;
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'slide' | 'text'>('slide');
  const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');
  const { t } = useLocale();
  const { pdfUrl, currentPage, highlights, highlightSnippet, scale, scrollNonce, sessionId, navigateToCitation } = useDocTalkStore();

  const documentName = useDocTalkStore((s) => s.documentName);
  const suggestedQuestions = useDocTalkStore((s) => s.suggestedQuestions);
  const documentStatus = useDocTalkStore((s) => s.documentStatus);
  const [showInstructions, setShowInstructions] = useState(false);
  const {
    error: loaderError,
    isDemo,
    fileType,
    hasConvertedPdf,
    convertedPdfUrl,
    customInstructions,
    setCustomInstructions,
  } = useDocumentLoader(documentId);
  const { sessionError } = useChatSession(documentId);
  const { isLoggedIn, userPlan, canUseCustomInstructions } = useUserPlanProfile();
  const error = loaderError || (sessionError ? t(sessionError) : null);

  usePageTitle(documentName || undefined);

  // Handle ?page=N&highlight=chunkId from "View in original" links
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get('question') || undefined;
  useEffect(() => {
    const pageParam = searchParams.get('page');
    let fallbackPage = 1;
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        fallbackPage = pageNum;
        useDocTalkStore.getState().setPage(pageNum);
      }
    }

    const highlightChunkId = searchParams.get('highlight');
    if (!highlightChunkId) return;

    let cancelled = false;
    void getChunkDetail(highlightChunkId)
      .then((chunk) => {
        if (cancelled) return;
        const page = chunk.page_start || fallbackPage;
        navigateToCitation({
          refIndex: 1,
          chunkId: chunk.chunk_id,
          page,
          bboxes: chunk.bboxes || [],
          textSnippet: chunk.text || '',
          offset: 0,
        });
      })
      .catch(() => {
        // The page parameter still lands the reader near the cited passage.
      });

    return () => { cancelled = true; };
  }, [searchParams, navigateToCitation]);

  // Determine which viewer to use:
  // - Native PDF: always PdfViewer with original URL
  // - PPTX/DOCX with converted PDF: PdfViewer (slide view) or TextViewer (text view), with toggle
  // - Other non-PDF: TextViewer only
  const useConvertedPdf = hasConvertedPdf && viewMode === 'slide' && convertedPdfUrl;
  const showViewToggle = hasConvertedPdf && fileType !== 'pdf';

  const viewToggle = showViewToggle ? (
    <div className="dt-view-toggle flex items-center gap-1 px-2 py-1">
      <button
        onClick={() => setViewMode('slide')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${viewMode === 'slide' ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-zinc-800'}`}
        title={t('viewer.slides')}
      >
        <Presentation size={14} />
        <span>{t('viewer.slides')}</span>
      </button>
      <button
        onClick={() => setViewMode('text')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${viewMode === 'text' ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-zinc-800'}`}
        title={t('viewer.text')}
      >
        <FileText size={14} />
        <span>{t('viewer.text')}</span>
      </button>
    </div>
  ) : null;

  const viewerContent = (
    <div className="h-full flex flex-col dt-reader-pane-document">
      {viewToggle}
      <div className="flex-1 min-h-0">
        {fileType === 'pdf' ? (
          pdfUrl ? (
            <PdfViewer pdfUrl={pdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} scrollNonce={scrollNonce} highlightSnippet={highlightSnippet} />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-zinc-500">{t('doc.loading')}</div>
          )
        ) : useConvertedPdf ? (
          <PdfViewer pdfUrl={convertedPdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} scrollNonce={scrollNonce} highlightSnippet={highlightSnippet} />
        ) : (
          <TextViewer documentId={documentId} fileType={fileType} targetPage={currentPage} scrollNonce={scrollNonce} highlightSnippet={highlightSnippet} />
        )}
      </div>
    </div>
  );

  const processingStatusText = documentStatus === 'parsing'
    ? t('status.parsing')
    : documentStatus === 'embedding'
      ? t('status.embedding')
      : documentStatus === 'ocr'
        ? t('status.ocr')
        : t('status.processing');

  const handleCitationClick = useCallback((citation: Citation) => {
    trackEvent('citation_clicked', {
      source: isDemo ? 'demo_reader' : 'document_reader',
      page: citation.page,
      has_bboxes: Boolean(citation.bboxes?.length),
    });
    navigateToCitation(citation);
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setMobileTab('document');
    }
  }, [isDemo, navigateToCitation]);

  const chatContent = documentStatus === 'ready' && sessionId ? (
    <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} initialQuestion={initialQuestion} onOpenSettings={canUseCustomInstructions ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={userPlan} />
  ) : documentStatus !== 'ready' && !error ? (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 py-8 text-zinc-500" role="status" aria-live="polite">
      <div className="w-full max-w-md space-y-3 animate-pulse motion-reduce:animate-none">
        <div className="flex justify-start">
          <div className="w-3/4 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3">
            <div className="h-2.5 w-11/12 rounded bg-zinc-300 dark:bg-zinc-700" />
          </div>
        </div>
        <div className="flex justify-end">
          <div className="w-2/3 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3">
            <div className="h-2.5 w-10/12 rounded bg-zinc-300 dark:bg-zinc-700" />
          </div>
        </div>
        <div className="flex justify-start">
          <div className="w-4/5 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3 space-y-2">
            <div className="h-2.5 w-full rounded bg-zinc-300 dark:bg-zinc-700" />
            <div className="h-2.5 w-9/12 rounded bg-zinc-300 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
      <p className="mt-5 text-sm">{t('doc.processing')}</p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{processingStatusText}</p>
    </div>
  ) : (
    <div className="h-full w-full flex items-center justify-center text-zinc-500">{t('doc.initChat')}</div>
  );

  // Onboarding tour — show once on first document ready
  useEffect(() => {
    if (documentStatus !== 'ready' || !sessionId) return;
    if (!shouldShowTour()) return;

    const timer = setTimeout(() => {
      startOnboardingTour(t, {
        showModeSelector: isLoggedIn && !isDemo,
      });
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentStatus, sessionId]);

  return (
    <div className="dt-reading-workspace flex flex-col h-screen w-full overflow-hidden">
      <Header isDemo={isDemo} isLoggedIn={isLoggedIn} />
      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-3">{error}</div>
            <button
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              onClick={() => router.push('/')}
            >
              {t('doc.backHome')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: side-by-side resizable panels */}
          <div className="hidden sm:flex flex-1 min-h-0 px-2 pb-2 gap-0">
            <Group orientation="horizontal" className="flex-1 min-h-0">
              <Panel defaultSize={50} minSize={25}>
                <div className="dt-reader-pane h-full min-w-0 sm:min-w-[320px] flex flex-col border rounded-l-xl overflow-hidden">
                  <div className="flex-1 min-h-0">
                    {chatContent}
                  </div>
                </div>
              </Panel>
              <Separator
                className="dt-reader-resizer w-4 sm:w-3 cursor-col-resize flex items-center justify-center"
                aria-label={t('doc.resizePanels')}
              >
                <div className="dt-reader-resizer-grip" />
              </Separator>
              <Panel defaultSize={50} minSize={35}>
                <div className="dt-reader-pane h-full border rounded-r-xl overflow-hidden">
                  {viewerContent}
                </div>
              </Panel>
            </Group>
          </div>

          {/* Mobile: full-width tab layout with both panels mounted */}
          <div className="flex sm:hidden flex-col flex-1 min-h-0">
            <div className={`flex-1 min-h-0 ${mobileTab === 'chat' ? '' : 'hidden'}`}>
              <div className="h-full min-w-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  {chatContent}
                </div>
              </div>
            </div>
            <div className={`flex-1 min-h-0 ${mobileTab === 'document' ? '' : 'hidden'}`}>
              <div className="h-full">
                {viewerContent}
              </div>
            </div>
            {/* Bottom tab bar */}
            <div className="flex border-t border-[var(--reader-border)] bg-[var(--reader-panel-solid)] shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
                  mobileTab === 'chat'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                <MessageSquare size={20} />
                {t('mobile.chatTab')}
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('document')}
                className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
                  mobileTab === 'document'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                <FileText size={20} />
                {t('mobile.documentTab')}
              </button>
            </div>
          </div>
        </>
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
