"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PdfViewer } from '../../../components/PdfViewer';
import TextViewer from '../../../components/TextViewer/TextViewer';
import { ChatPanel } from '../../../components/Chat';
import Header from '../../../components/Header';
import CustomInstructionsModal from '../../../components/CustomInstructionsModal';
import { updateDocumentInstructions } from '../../../lib/api';
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
  const error = loaderError || sessionError;

  usePageTitle(documentName || undefined);

  // Determine which viewer to use:
  // - Native PDF: always PdfViewer with original URL
  // - PPTX/DOCX with converted PDF: PdfViewer (slide view) or TextViewer (text view), with toggle
  // - Other non-PDF: TextViewer only
  const useConvertedPdf = hasConvertedPdf && viewMode === 'slide' && convertedPdfUrl;
  const showViewToggle = hasConvertedPdf && fileType !== 'pdf';

  const viewToggle = showViewToggle ? (
    <div className="flex items-center gap-1 px-2 py-1 border-b bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
      <button
        onClick={() => setViewMode('slide')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${viewMode === 'slide' ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
        title={t('viewer.slides')}
      >
        <Presentation size={14} />
        <span>{t('viewer.slides')}</span>
      </button>
      <button
        onClick={() => setViewMode('text')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${viewMode === 'text' ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
        title={t('viewer.text')}
      >
        <FileText size={14} />
        <span>{t('viewer.text')}</span>
      </button>
    </div>
  ) : null;

  const viewerContent = (
    <div className="h-full flex flex-col">
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
    navigateToCitation(citation);
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setMobileTab('document');
    }
  }, [navigateToCitation]);

  const chatContent = documentStatus === 'ready' && sessionId ? (
    <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} onOpenSettings={canUseCustomInstructions ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={userPlan} />
  ) : documentStatus !== 'ready' && !error ? (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 py-8 text-zinc-500" role="status" aria-live="polite">
      <div className="w-full max-w-md space-y-3 animate-pulse motion-reduce:animate-none">
        <div className="flex justify-start">
          <div className="w-3/4 rounded-2xl bg-zinc-200 dark:bg-zinc-800 p-3">
            <div className="h-2.5 w-11/12 rounded bg-zinc-300 dark:bg-zinc-700" />
          </div>
        </div>
        <div className="flex justify-end">
          <div className="w-2/3 rounded-2xl bg-zinc-200 dark:bg-zinc-800 p-3">
            <div className="h-2.5 w-10/12 rounded bg-zinc-300 dark:bg-zinc-700" />
          </div>
        </div>
        <div className="flex justify-start">
          <div className="w-4/5 rounded-2xl bg-zinc-200 dark:bg-zinc-800 p-3 space-y-2">
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
    <div className="flex flex-col h-screen w-full overflow-hidden">
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
          <div className="hidden sm:flex flex-1 min-h-0">
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
            <div className="flex border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
                  mobileTab === 'chat'
                    ? 'text-indigo-600 dark:text-indigo-400'
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
                    ? 'text-indigo-600 dark:text-indigo-400'
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
