"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDocumentBrief } from "./api";
import { beginLatestRequest, isLatestRequest } from "./latestRequest";
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
  latestRequestOrdinal: number;
}

type BriefRequestResult =
  | { scope: BriefRequestScope; ordinal: number; data: DocumentHierarchicalBrief; error?: never }
  | { scope: BriefRequestScope; ordinal: number; data?: never; error: unknown };

export function useDocumentBrief(documentId: string | undefined): UseDocumentBriefResult {
  const [brief, setBrief] = useState<DocumentHierarchicalBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const pollAttemptsRef = useRef(0);
  const nextRequestOrdinalRef = useRef(0);
  const requestScopeRef = useRef<BriefRequestScope>({
    documentId,
    latestRequestOrdinal: 0,
  });

  // Replace the token synchronously on every document switch, including
  // A -> B -> A and disablement. Any request holding an older object can no
  // longer publish into the current document's state.
  if (requestScopeRef.current.documentId !== documentId) {
    requestScopeRef.current = { documentId, latestRequestOrdinal: 0 };
    pollAttemptsRef.current = 0;
  }

  const requestBrief = useCallback(async (): Promise<BriefRequestResult | null> => {
    const scope = requestScopeRef.current;
    if (!scope.documentId) return null;
    const ticket = beginLatestRequest(scope, nextRequestOrdinalRef);

    try {
      const data = await getDocumentBrief(scope.documentId);
      if (!isLatestRequest(requestScopeRef.current, ticket)) return null;
      return { scope, ordinal: ticket.ordinal, data };
    } catch (requestError) {
      if (!isLatestRequest(requestScopeRef.current, ticket)) return null;
      return { scope, ordinal: ticket.ordinal, error: requestError };
    }
  }, []);

  const applyResult = useCallback((result: BriefRequestResult | null) => {
    if (
      !result
      || !isLatestRequest(requestScopeRef.current, {
        scope: result.scope,
        ordinal: result.ordinal,
      })
    ) return;
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
      pollAttemptsRef.current = 0;
      setPollAttempts(0);
      return;
    }
    const scope = requestScopeRef.current;
    setBrief(null);
    setLoading(true);
    setError(null);
    pollAttemptsRef.current = 0;
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
    const scope = requestScopeRef.current;
    const timer = window.setInterval(() => {
      if (requestScopeRef.current !== scope || !scope.documentId) return;
      if (brief?.status === "empty" && pollAttemptsRef.current >= 20) return;
      pollAttemptsRef.current += 1;
      setPollAttempts(pollAttemptsRef.current);
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
