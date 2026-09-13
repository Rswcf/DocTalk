"use client";

import { useCallback, useEffect, useState } from 'react';
import { ApiError, getCheckoutStatus, type CheckoutStatus } from './api';

export type CheckoutViewStatus = CheckoutStatus | 'checking' | 'unavailable' | 'delayed';

export function useCheckoutStatus(sessionId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<CheckoutViewStatus>('checking');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    if (!sessionId) { setStatus('unavailable'); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    setStatus('checking');
    const check = async () => {
      try {
        const result = await getCheckoutStatus(sessionId);
        if (cancelled) return;
        setStatus(result.status);
        if (result.status === 'complete' || result.status === 'expired') return;
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status < 500 && error.status !== 429) {
          setStatus('unavailable'); return;
        }
        setStatus('checking');
      }
      if (++polls >= 20) { setStatus('delayed'); return; }
      timer = setTimeout(() => { void check(); }, 3000);
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId, enabled, attempt]);
  return { status, retry };
}
