"use client";

import { useCallback, useEffect, useState } from "react";
import { getDocumentBrief } from "./api";
import type { DocumentHierarchicalBrief } from "../types";

interface UseDocumentBriefResult {
  brief: DocumentHierarchicalBrief | null;
  loading: boolean;
  polling: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function shouldPoll(status?: string | null): boolean {
  return status === "pending" || status === "empty";
}

export function useDocumentBrief(documentId: string | undefined): UseDocumentBriefResult {
  const [brief, setBrief] = useState<DocumentHierarchicalBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);

  const refresh = useCallback(async () => {
    if (!documentId) return;
    setError(null);
    const data = await getDocumentBrief(documentId);
    setBrief(data);
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      setBrief(null);
      setLoading(false);
      setError(null);
      setPollAttempts(0);
      return;
    }
    let cancelled = false;
    setBrief(null);
    setLoading(true);
    setError(null);
    setPollAttempts(0);
    getDocumentBrief(documentId)
      .then((data) => {
        if (cancelled) return;
        setBrief(data);
        setPollAttempts(0);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load document brief");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!shouldPoll(brief?.status)) return;
    if (brief?.status === "empty" && pollAttempts >= 20) return;
    const timer = window.setInterval(() => {
      setPollAttempts((current) => current + 1);
      void refresh().catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to refresh document brief");
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [brief?.status, pollAttempts, refresh]);

  const wrappedRefresh = useCallback(async () => {
    setLoading((current) => current || !brief);
    try {
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [brief, refresh]);

  const polling = Boolean(
    documentId && (
      loading
      || brief?.status === "pending"
      || (brief?.status === "empty" && pollAttempts < 20)
    )
  );

  return { brief, loading, polling, error, refresh: wrappedRefresh };
}
