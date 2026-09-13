"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

interface Origin {
  documentId: string;
  sessionId: string | null;
  messageId: string;
  offset: number;
  trigger: HTMLElement | null;
}

/** Keep the answer's visual position across mobile pane/layout changes. */
export function useCitationReturn(documentId: string, sessionId: string | null, revealChat: () => void) {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const generation = useRef(0);
  const frame = useRef(0);
  const currentScope = useRef({ documentId, sessionId });
  currentScope.current = { documentId, sessionId };
  useEffect(() => {
    setOrigin(null); generation.current += 1;
    return () => { generation.current += 1; cancelAnimationFrame(frame.current); };
  }, [documentId, sessionId]);

  const capture = useCallback((messageId?: string) => {
    generation.current += 1;
    cancelAnimationFrame(frame.current);
    const row = messageId ? document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`) : null;
    const list = row?.closest<HTMLElement>('.dt-chat-scroll');
    setOrigin(row && list && messageId ? {
      documentId, sessionId, messageId,
      offset: row.getBoundingClientRect().top - list.getBoundingClientRect().top,
      trigger: document.activeElement instanceof HTMLElement && row.contains(document.activeElement) ? document.activeElement : null,
    } : null);
  }, [documentId, sessionId]);

  const returnToAnswer = useCallback(() => {
    if (!origin || origin.documentId !== documentId || origin.sessionId !== sessionId) return;
    const token = ++generation.current;
    revealChat();
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        if (token !== generation.current || currentScope.current.documentId !== origin.documentId || currentScope.current.sessionId !== origin.sessionId) return;
        const row = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(origin.messageId)}"]`);
        const list = row?.closest<HTMLElement>('.dt-chat-scroll');
        if (!row || !list || !list.clientHeight) {
          setOrigin(null);
          document.querySelector<HTMLElement>('.dt-chat-scroll')?.focus({ preventScroll: true });
          return;
        }
        list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - origin.offset;
        (origin.trigger?.isConnected && row.contains(origin.trigger) ? origin.trigger : row).focus({ preventScroll: true });
      });
    });
  }, [origin, documentId, sessionId, revealChat]);

  return { capture, returnToAnswer, canReturn: Boolean(origin && origin.documentId === documentId && origin.sessionId === sessionId) };
}
