"use client";

import { useEffect, useState } from 'react';
import { getDocument, getDocumentFileUrl, getConvertedFileUrl } from './api';
import { sanitizeFilename } from './utils';
import { useLocale } from '../i18n';
import { useDocTalkStore } from '../store';

interface UseDocumentLoaderResult {
  error: string | null;
  isDemo: boolean;
  fileType: string;
  hasConvertedPdf: boolean;
  convertedPdfUrl: string | null;
  customInstructions: string | null;
  setCustomInstructions: (instructions: string | null) => void;
}

export function useDocumentLoader(documentId: string | undefined): UseDocumentLoaderResult {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
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
  } = useDocTalkStore();

  useEffect(() => {
    if (!documentId) return;

    setError(null);
    setIsDemo(false);
    setFileType('pdf');
    setHasConvertedPdf(false);
    setConvertedPdfUrl(null);
    setCustomInstructions(null);
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

          if (info.has_converted_pdf) {
            setHasConvertedPdf(true);
            getConvertedFileUrl(documentId)
              .then((file) => {
                if (!cancelled) setConvertedPdfUrl(file.url);
              })
              .catch((e) => console.error('Failed to load converted PDF:', e));
          }

          if (intervalId) clearInterval(intervalId);
        }
      } catch (e: unknown) {
        if (cancelled) return;

        const msg = String((e as { message?: unknown })?.message || e || '');
        if (msg.includes('HTTP 404')) {
          setError(t('doc.notFound'));
        } else {
          setError(t('doc.loadError'));
        }

        if (intervalId) clearInterval(intervalId);
      }
    };

    (async () => {
      try {
        const file = await getDocumentFileUrl(documentId);
        if (!cancelled) setPdfUrl(file.url);
      } catch {
        // PdfViewer shows its own error state.
      }
    })();

    fetchStatus();
    intervalId = setInterval(fetchStatus, 3000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [documentId, setDocument, setPdfUrl, setDocumentName, setDocumentStatus, setLastDocument, setDocumentSummary, setSuggestedQuestions, t]);

  return {
    error,
    isDemo,
    fileType,
    hasConvertedPdf,
    convertedPdfUrl,
    customInstructions,
    setCustomInstructions,
  };
}
