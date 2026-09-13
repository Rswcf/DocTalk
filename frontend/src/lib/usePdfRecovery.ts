"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

/** Renew credentials once automatically per file, then wait for an explicit retry. */
export function usePdfRecovery(pdfUrl: string, refreshUrl?: () => Promise<string | undefined>) {
  const fileKey = (() => {
    try { const url = new URL(pdfUrl); return url.origin + url.pathname; }
    catch { return pdfUrl; }
  })();
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const state = useRef({ fileKey, attempted: false, running: false, active: true });
  const latestUrl = useRef(pdfUrl);
  latestUrl.current = pdfUrl;

  useEffect(() => {
    const generation = { fileKey, attempted: false, running: false, active: true };
    state.current = generation;
    setRefreshing(false);
    setError(null);
    return () => { generation.active = false; };
  }, [fileKey]);

  const retry = useCallback(async (automatic = false) => {
    const generation = state.current;
    if (!generation.active || generation.fileKey !== fileKey || generation.running
        || (automatic && (generation.attempted || !refreshUrl))
        || latestUrl.current !== pdfUrl) return;
    generation.attempted = true;
    generation.running = true;
    setRefreshing(true);
    setError(null);
    try {
      const renewed = refreshUrl ? await refreshUrl() : pdfUrl;
      if (!generation.active || state.current !== generation || !renewed) return;
      // A signer may return the same URL within one second. Remount in that
      // case as well; otherwise react-pdf retains its rejected loading task.
      if (renewed === pdfUrl) setRevision((value) => value + 1);
    } catch (error: unknown) {
      // Keep the reader's existing error and explicit retry, without loops.
      if (generation.active && state.current === generation) setError(error);
    } finally {
      if (generation.active && state.current === generation) {
        generation.running = false;
        setRefreshing(false);
      }
    }
  }, [fileKey, pdfUrl, refreshUrl]);

  return { refreshing, revision, retry, error };
}
