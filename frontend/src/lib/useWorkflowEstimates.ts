"use client";

import { useCallback, useEffect, useState } from 'react';
import { getWorkflowEstimates, type WorkflowEstimates } from './api';

export function useWorkflowEstimates(enabled: boolean) {
  const [costs, setCosts] = useState<WorkflowEstimates | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setCosts(null);
    setFailed(false);
    getWorkflowEstimates().then(result => {
      if (!cancelled) setCosts(result);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [enabled, attempt]);
  return { costs, failed, retry };
}
