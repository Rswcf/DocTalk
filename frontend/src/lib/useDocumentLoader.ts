"use client";

import { useCallback, useEffect, useState } from 'react';
import { ApiError, getDocument, getDocumentFileUrl, getConvertedFileUrl } from './api';
import { errorCopy, parseWorkerErrorMsg } from './errorCopy';
import { sanitizeFilename } from './utils';
import { useLocale } from '../i18n';
import { useDocTalkStore } from '../store';
import type { DocumentResponse } from '../types';

function shouldRetryLoaderError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

interface UseDocumentLoaderResult {
  error: string | null;
  errorCode: string | null;
  reload: () => void;
  isDemo: boolean;
  fileType: string;
  hasConvertedPdf: boolean;
  convertedPdfUrl: string | null;
  customInstructions: string | null;
  setCustomInstructions: (instructions: string | null) => void;
}

export function useDocumentLoader(documentId: string | undefined): UseDocumentLoaderResult {
  const { t, tOr } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDemo, setIsDemo] = useState(false);
  const [fileType, setFileType] = useState<string>('pdf');
  const [hasConvertedPdf, setHasConvertedPdf] = useState(false);
  const [convertedPdfUrl, setConvertedPdfUrl] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string | null>(null);

  const {
    setDocument,
    setPdfUrl,
    setDocumentName,
    setDocumentStatus,
    setLastDocument,
    setDocumentSummary,
    setSuggestedQuestions,
    clearDocumentTransientState,
  } = useDocTalkStore();

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!documentId) return;

    setError(null);
    setErrorCode(null);
    setIsDemo(false);
    setFileType('pdf');
    setHasConvertedPdf(false);
    setConvertedPdfUrl(null);
    setCustomInstructions(null);
    // When switching between documents (e.g. inside a Collection), wipe the
    // per-document viewer overlays so doc B doesn't inherit doc A's active
    // citation highlights, search query/matches, or grab-mode toggle.
    clearDocumentTransientState();
    setDocument(documentId);
    setPdfUrl(null);

    let intervalId: NodeJS.Timeout | null = null;
    let cancelled = false;

    const fetchStatus = async () => {
      let info: DocumentResponse;
      try {
        info = await getDocument(documentId);
      } catch (e: unknown) {
        if (cancelled) return;
        const copy = errorCopy(e, t, tOr);
        if (e instanceof ApiError && e.status === 404) {
          setError(t('doc.notFound'));
        } else {
          console.error('Failed to load document metadata:', e);
          setError(copy.body || t('doc.loadError'));
        }
        setErrorCode(null);
        if (!shouldRetryLoaderError(e) && intervalId) clearInterval(intervalId);
        return;
      }

      try {
        if (cancelled) return;
        setError(null);
        setErrorCode(null);
        setDocumentStatus(info.status);
        if (info.is_demo) setIsDemo(true);
        if (info.file_type) setFileType(info.file_type);

        if (info.filename) {
          const safeName = sanitizeFilename(info.filename);
          setDocumentName(safeName);
          setLastDocument(documentId, safeName);
        }

        if (info.status === 'error') {
          const { code, fallback } = parseWorkerErrorMsg(info.error_msg);
          if (code) {
            const copy = errorCopy({ code, detail: {} }, t, tOr);
            setError(copy.body);
            setErrorCode(code);
          } else {
            setError(fallback || t('upload.error'));
            setErrorCode(null);
          }
          if (intervalId) clearInterval(intervalId);
          return;
        }

        if (info.status === 'ready') {
          // Unconditional set: a doc WITHOUT summary/questions must clear the
          // previous doc's values, not inherit them (cross-doc leak fix).
          setDocumentSummary(info.summary || null);
          setSuggestedQuestions(info.suggested_questions ?? []);
          if (info.custom_instructions !== undefined) setCustomInstructions(info.custom_instructions ?? null);
          const readyFileType = info.file_type || 'pdf';

          if (readyFileType === 'pdf') {
            try {
              const file = await getDocumentFileUrl(documentId);
              if (cancelled) return;
              setPdfUrl(file.url);
            } catch (e: unknown) {
              if (cancelled) return;
              const copy = errorCopy(e, t, tOr);
              console.error('Failed to load PDF:', e);
              setError(copy.body || t('doc.loadError'));
              setErrorCode(null);
              if (!shouldRetryLoaderError(e) && intervalId) clearInterval(intervalId);
              return;
            }
          }

          if (info.has_converted_pdf) {
            setHasConvertedPdf(true);
            try {
              const file = await getConvertedFileUrl(documentId);
              if (cancelled) return;
              setConvertedPdfUrl(file.url);
            } catch (e: unknown) {
              if (cancelled) return;
              const copy = errorCopy(e, t, tOr);
              console.error('Failed to load converted PDF:', e);
              setError(copy.body || t('doc.loadError'));
              setErrorCode(null);
              if (!shouldRetryLoaderError(e) && intervalId) clearInterval(intervalId);
              return;
            }
          }

          if (intervalId) clearInterval(intervalId);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        console.error('Failed to process document metadata:', e);
        setError(t('doc.loadError'));
        setErrorCode(null);
        if (intervalId) clearInterval(intervalId);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 3000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [documentId, reloadKey, setDocument, setPdfUrl, setDocumentName, setDocumentStatus, setLastDocument, setDocumentSummary, setSuggestedQuestions, clearDocumentTransientState, t, tOr]);

  return {
    error,
    errorCode,
    reload,
    isDemo,
    fileType,
    hasConvertedPdf,
    convertedPdfUrl,
    customInstructions,
    setCustomInstructions,
  };
}
