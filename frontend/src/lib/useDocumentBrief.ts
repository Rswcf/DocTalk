"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

interface BriefRequestScope {
  documentId: string | undefined;
}

type BriefRequestResult =
  | { scope: BriefRequestScope; data: DocumentHierarchicalBrief; error?: never }
  | { scope: BriefRequestScope; data?: never; error: unknown };

export function useDocumentBrief(documentId: string | undefined): UseDocumentBriefResult {
  const [brief, setBrief] = useState<DocumentHierarchicalBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const requestScopeRef = useRef<BriefRequestScope>({ documentId });

  // Replace the token synchronously on every document switch, including
  // A -> B -> A and disablement. Any request holding an older object can no
  // longer publish into the current document's state.
  if (requestScopeRef.current.documentId !== documentId) {
    requestScopeRef.current = { documentId };
  }

  const requestBrief = useCallback(async (): Promise<BriefRequestResult | null> => {
    const scope = requestScopeRef.current;
    if (!scope.documentId) return null;

    try {
      const data = await getDocumentBrief(scope.documentId);
      if (requestScopeRef.current !== scope) return null;
      return { scope, data };
    } catch (requestError) {
      if (requestScopeRef.current !== scope) return null;
      return { scope, error: requestError };
    }
  }, []);

  const applyResult = useCallback((result: BriefRequestResult | null) => {
    if (!result || requestScopeRef.current !== result.scope) return;
    if ("error" in result) {
      setError(result.error instanceof Error ? result.error.message : "Failed to load document brief");
      return;
    }
    setError(null);
    setBrief(result.data);
  }, []);

  const refresh = useCallback(async () => {
    applyResult(await requestBrief());
  }, [applyResult, requestBrief]);

  useEffect(() => {
    if (!documentId) {
      setBrief(null);
      setLoading(false);
      setError(null);
      setPollAttempts(0);
      return;
    }
    const scope = requestScopeRef.current;
    setBrief(null);
    setLoading(true);
    setError(null);
    setPollAttempts(0);
    void requestBrief().then((result) => {
      if (requestScopeRef.current !== scope) return;
      applyResult(result);
      setPollAttempts(0);
      setLoading(false);
    });
  }, [applyResult, documentId, requestBrief]);

  useEffect(() => {
    if (!shouldPoll(brief?.status)) return;
    if (brief?.status === "empty" && pollAttempts >= 20) return;
    const timer = window.setInterval(() => {
      setPollAttempts((current) => current + 1);
      void refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [brief?.status, pollAttempts, refresh]);

  const wrappedRefresh = useCallback(async () => {
    const scope = requestScopeRef.current;
    setLoading((current) => current || !brief);
    try {
      await refresh();
    } finally {
      if (requestScopeRef.current === scope) {
        setLoading(false);
      }
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
