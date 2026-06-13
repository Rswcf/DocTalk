"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PdfViewer } from '../../../components/PdfViewer';
import TextViewer from '../../../components/TextViewer/TextViewer';
import { ChatPanel } from '../../../components/Chat';
import Header from '../../../components/Header';
import CustomInstructionsModal from '../../../components/CustomInstructionsModal';
import LayoutTranslationDrawer from '../../../components/LayoutTranslation/LayoutTranslationDrawer';
import { ApiError, createLayoutTranslation, getChunkDetail, updateDocumentInstructions } from '../../../lib/api';
import { PaywallModal } from '../../../components/PaywallModal';
import { useDocTalkStore } from '../../../store';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useLocale } from '../../../i18n';
import { usePageTitle } from '../../../lib/usePageTitle';
import { AlertTriangle, Download, FileText, MessageSquare, Presentation, X } from 'lucide-react';
import { useDocumentLoader } from '../../../lib/useDocumentLoader';
import { useChatSession } from '../../../lib/useChatSession';
import { useUserPlanProfile } from '../../../lib/useUserPlanProfile';
import { errorCopy } from '../../../lib/errorCopy';
import { openAuthModal } from '../../../lib/auth-modal';
import type { ChatArtifact, Citation } from '../../../types';
import { trackEvent } from '../../../lib/analytics';
import { layoutTranslationTargetLabel, proxiedArtifactUrl } from '../../../lib/layoutTranslation';

function useDesktopReaderLayout() {
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 640px)');
    const sync = () => setIsDesktopLayout(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isDesktopLayout;
}

export default function DocumentReaderPageClient() {
  const params = useParams<{ documentId: string }>();
  const documentId = params?.documentId as string;
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'slide' | 'text'>('slide');
  const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');
  const isDesktopLayout = useDesktopReaderLayout();
  const { t, tOr, locale } = useLocale();
  const { pdfUrl, currentPage, highlights, highlightSnippet, scale, scrollNonce, sessionId, navigateToCitation, totalPages } = useDocTalkStore();
  const addMessage = useDocTalkStore((s) => s.addMessage);

  const documentName = useDocTalkStore((s) => s.documentName);
  const suggestedQuestions = useDocTalkStore((s) => s.suggestedQuestions);
  const documentStatus = useDocTalkStore((s) => s.documentStatus);
  const [showInstructions, setShowInstructions] = useState(false);
  const [layoutTranslationBusy, setLayoutTranslationBusy] = useState(false);
  const [layoutTranslationDrawerOpen, setLayoutTranslationDrawerOpen] = useState(false);
  const [layoutTranslationError, setLayoutTranslationError] = useState<string | null>(null);
  const [layoutPaywallOpen, setLayoutPaywallOpen] = useState(false);
  const [layoutPaywallReason, setLayoutPaywallReason] = useState<string | null>(null);
  const [translatedPreview, setTranslatedPreview] = useState<{
    url: string;
    downloadUrl: string | null;
    targetLanguageLabel: string;
    jobId: string | null;
  } | null>(null);
  const [pdfPreviewMode, setPdfPreviewMode] = useState<'original' | 'translated'>('original');
  const layoutTranslationJobIdsRef = useRef<Set<string>>(new Set());
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
  const sessionErrorCopy = sessionError ? errorCopy(sessionError, t, tOr) : null;
  const error = loaderError;

  usePageTitle(documentName || undefined);

  // Handle ?page=N&highlight=chunkId from "View in original" links
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get('question') || undefined;
  const revealMobileDocumentPane = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setMobileTab('document');
    }
  }, []);

  useEffect(() => {
    const pageParam = searchParams.get('page');
    let fallbackPage = 1;
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        fallbackPage = pageNum;
        useDocTalkStore.getState().setPage(pageNum);
        revealMobileDocumentPane();
      }
    }

    const highlightChunkId = searchParams.get('highlight');
    if (!highlightChunkId) return;
    revealMobileDocumentPane();

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
  }, [searchParams, navigateToCitation, revealMobileDocumentPane]);

  // Determine which viewer to use:
  // - Native PDF: always PdfViewer with original URL
  // - PPTX/DOCX with converted PDF: PdfViewer (slide view) or TextViewer (text view), with toggle
  // - Other non-PDF: TextViewer only
  const useConvertedPdf = hasConvertedPdf && viewMode === 'slide' && convertedPdfUrl;
  const showViewToggle = hasConvertedPdf && fileType !== 'pdf';

  useEffect(() => {
    setTranslatedPreview(null);
    setPdfPreviewMode('original');
    setLayoutTranslationDrawerOpen(false);
  }, [documentId]);

  const handleOpenLayoutTranslation = useCallback(() => {
    if (!isLoggedIn) {
      openAuthModal();
      return;
    }
    setLayoutTranslationError(null);
    setLayoutTranslationDrawerOpen(true);
  }, [isLoggedIn]);

  const handleLayoutTranslationSubmit = useCallback(async ({ targetLanguage, addToLibrary }: { targetLanguage: string; addToLibrary: boolean }) => {
    if (layoutTranslationBusy) return;
    if (!isLoggedIn) {
      openAuthModal();
      return;
    }
    setLayoutTranslationBusy(true);
    setLayoutTranslationError(null);
    try {
      const job = await createLayoutTranslation({
        documentId,
        targetLanguage,
        locale,
        addToLibrary,
      });
      if (!layoutTranslationJobIdsRef.current.has(job.id)) {
        layoutTranslationJobIdsRef.current.add(job.id);
        addMessage({
          id: `layout_translation_${job.id}`,
          role: 'assistant',
          text: tOr(
            'layoutTranslation.chatMessage',
            'I started a layout-preserving translation for this PDF. You can keep working while it runs.',
            { language: layoutTranslationTargetLabel(targetLanguage) },
          ),
          artifacts: [job.artifact],
          createdAt: Date.now(),
        });
      }
      trackEvent('layout_translation_created', {
        source: 'document_toolbar',
        plan: userPlan || 'unknown',
        target_language: targetLanguage,
        add_to_library: addToLibrary,
      });
      setLayoutTranslationDrawerOpen(false);
      setMobileTab('chat');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
        setLayoutPaywallReason(err.code);
        setLayoutPaywallOpen(true);
        trackEvent('limit_hit', {
          source: 'layout_translation_toolbar',
          reason: err.code,
          plan: 'plus',
          period: 'monthly',
        });
      } else {
        const copy = errorCopy(err, t, tOr);
        setLayoutTranslationError(`${copy.title}: ${copy.body}`);
        setLayoutTranslationDrawerOpen(false);
      }
    } finally {
      setLayoutTranslationBusy(false);
    }
  }, [addMessage, documentId, isLoggedIn, layoutTranslationBusy, locale, t, tOr, userPlan]);

  const handlePreviewLayoutTranslation = useCallback((url: string, artifact: ChatArtifact) => {
    const preview = artifact.preview && typeof artifact.preview === 'object'
      ? artifact.preview as Record<string, unknown>
      : {};
    const pdfDownload = artifact.downloadUrls?.find((item) => item.format === 'pdf');
    setTranslatedPreview({
      url,
      downloadUrl: pdfDownload?.url ? proxiedArtifactUrl(pdfDownload.url) : null,
      targetLanguageLabel: typeof preview.target_language_label === 'string'
        ? preview.target_language_label
        : layoutTranslationTargetLabel(typeof preview.target_language === 'string' ? preview.target_language : null),
      jobId: artifact.jobId || null,
    });
    setPdfPreviewMode('translated');
    revealMobileDocumentPane();
    trackEvent('layout_translation_preview_opened', {
      source: 'artifact_card',
      job_id: artifact.jobId || undefined,
    });
  }, [revealMobileDocumentPane]);

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
      {layoutTranslationError ? (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{layoutTranslationError}</span>
          <button
            type="button"
            onClick={() => setLayoutTranslationError(null)}
            className="rounded p-0.5 text-amber-800 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
            aria-label={tOr('common.dismiss', 'Dismiss')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="flex-1 min-h-0">
        {fileType === 'pdf' ? (
          pdfUrl ? (
            <div className="h-full min-h-0 flex flex-col">
              {translatedPreview ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 py-2">
                  <div className="inline-flex rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setPdfPreviewMode('original')}
                      className={`min-h-8 rounded-md px-3 transition-colors ${pdfPreviewMode === 'original' ? 'bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm' : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'}`}
                    >
                      {tOr('layoutTranslation.originalPdf', 'Original')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfPreviewMode('translated')}
                      className={`min-h-8 rounded-md px-3 transition-colors ${pdfPreviewMode === 'translated' ? 'bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm' : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'}`}
                    >
                      {tOr('layoutTranslation.translatedPdf', 'Translated')}
                    </button>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--reader-muted)]">
                    <span className="truncate">{translatedPreview.targetLanguageLabel}</span>
                    {translatedPreview.downloadUrl ? (
                      <a
                        href={translatedPreview.downloadUrl}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--reader-border)] px-2 font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)]"
                      >
                        <Download size={13} aria-hidden="true" />
                        {tOr('layoutTranslation.downloadPdf', 'Translated PDF')}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="flex-1 min-h-0">
                <PdfViewer
                  pdfUrl={pdfPreviewMode === 'translated' && translatedPreview ? translatedPreview.url : pdfUrl}
                  currentPage={currentPage}
                  highlights={pdfPreviewMode === 'translated' ? [] : highlights}
                  scale={scale}
                  scrollNonce={scrollNonce}
                  highlightSnippet={pdfPreviewMode === 'translated' ? null : highlightSnippet}
                  onLayoutTranslate={handleOpenLayoutTranslation}
                  layoutTranslateBusy={layoutTranslationBusy}
                  layoutTranslateDisabled={documentStatus !== 'ready'}
                />
              </div>
            </div>
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
    revealMobileDocumentPane();
  }, [isDemo, navigateToCitation, revealMobileDocumentPane]);

  useEffect(() => {
    if (isDesktopLayout !== false || mobileTab !== 'document') return;
    if (highlights.length === 0 && !highlightSnippet) return;
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        useDocTalkStore.setState((state) => ({ scrollNonce: state.scrollNonce + 1 }));
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [isDesktopLayout, mobileTab, currentPage, highlights, highlightSnippet]);

  const chatContent = documentStatus === 'ready' && sessionId ? (
    <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} onPreviewLayoutTranslation={handlePreviewLayoutTranslation} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} initialQuestion={initialQuestion} autoSubmitInitialQuestion={isDemo} onOpenSettings={canUseCustomInstructions ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={userPlan} />
  ) : sessionErrorCopy ? (
    <div className="flex h-full w-full items-center justify-center px-5 py-8">
      <div
        className={`w-full max-w-md rounded-2xl border px-5 py-4 text-sm shadow-sm ${
          sessionErrorCopy.severity === 'warning'
            ? 'border-amber-300/40 bg-amber-50 text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100'
            : sessionErrorCopy.severity === 'info'
              ? 'border-blue-300/40 bg-blue-50 text-blue-950 dark:border-blue-300/25 dark:bg-blue-300/10 dark:text-blue-100'
              : 'border-red-300/40 bg-red-50 text-red-950 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-100'
        }`}
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold">{sessionErrorCopy.title}</p>
        <p className="mt-2 leading-6 opacity-90">{sessionErrorCopy.body}</p>
        {sessionErrorCopy.cta && (
          <button
            type="button"
            onClick={() => router.push(sessionErrorCopy.cta!.href)}
            className="mt-4 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {sessionErrorCopy.cta.label}
          </button>
        )}
      </div>
    </div>
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

  return (
    <div className="dt-stitch-theme dt-reading-workspace flex flex-col h-screen w-full overflow-hidden">
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
          {isDesktopLayout === null ? (
            <div className="flex-1 min-h-0 px-2 pb-2">
              <div className="dt-reader-pane h-full border rounded-xl overflow-hidden flex items-center justify-center text-zinc-500">
                {t('doc.loading')}
              </div>
            </div>
          ) : isDesktopLayout ? (
            <div className="relative flex flex-1 min-h-0 px-2 pb-2 gap-0">
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
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
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
          )}
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
      <PaywallModal
        isOpen={layoutPaywallOpen}
        onClose={() => setLayoutPaywallOpen(false)}
        reason={layoutPaywallReason}
        currentPlan={userPlan}
      />
      <LayoutTranslationDrawer
        isOpen={layoutTranslationDrawerOpen}
        busy={layoutTranslationBusy}
        documentName={documentName}
        pageCount={totalPages || undefined}
        userPlan={userPlan}
        onClose={() => setLayoutTranslationDrawerOpen(false)}
        onSubmit={handleLayoutTranslationSubmit}
      />
    </div>
  );
}
