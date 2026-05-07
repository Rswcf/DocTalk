"use client";

import { useCallback, useEffect, useState } from "react";
import { getDocumentBrief } from "./api";
import type { DocumentHierarchicalBrief } from "../types";

interface UseDocumentBriefResult {
  brief: DocumentHierarchicalBrief | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function shouldPoll(status?: string | null): boolean {
  return status === "pending" || status === "empty";
}

export function useDocumentBrief(documentId: string): UseDocumentBriefResult {
  const [brief, setBrief] = useState<DocumentHierarchicalBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    const data = await getDocumentBrief(documentId);
    setBrief(data);
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
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
    if (brief?.status === "empty" && pollAttempts >= 10) return;
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

  return { brief, loading, error, refresh: wrappedRefresh };
}
