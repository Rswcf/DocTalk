import type { Citation } from '../types';
import { PROXY_BASE } from './api';

type TokenPayload = { text: string };
type CitationPayload = {
  ref_index: number;
  chunk_id: string;
  page: number;
  page_end?: number;
  bboxes: { x: number; y: number; w: number; h: number; page?: number }[];
  text_snippet: string;
  offset: number;
};
type CitationEventPayload = CitationPayload & {
  document_id?: string;
  document_filename?: string;
};
type ErrorPayload = { code: string; message: string };
type DonePayload = { message_id: string; can_continue?: boolean; continuation_count?: number };

async function _processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (p: TokenPayload) => void,
  onCitation: (c: Citation) => void,
  onError: (e: ErrorPayload) => void,
  onDone: (d: DonePayload) => void,
  onTruncated?: () => void,
  signal?: AbortSignal,
) {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let receivedDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const lines = rawEvent.split('\n');
        let eventName = 'message';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            dataStr += line.replace('data:', '').trim();
          }
        }

        if (!dataStr) continue;
        try {
          const data = JSON.parse(dataStr) as Record<string, unknown>;
          switch (eventName) {
            case 'token':
              onToken({ text: typeof data.text === 'string' ? data.text : '' });
              break;
            case 'citation': {
              const p = data as CitationEventPayload;
              const c: Citation = {
                refIndex: p.ref_index,
                chunkId: p.chunk_id,
                page: p.page,
                pageEnd: typeof p.page_end === 'number' ? p.page_end : undefined,
                bboxes: p.bboxes || [],
                textSnippet: p.text_snippet || '',
                offset: p.offset ?? 0,
                documentId: typeof p.document_id === 'string' ? p.document_id : undefined,
                documentFilename: typeof p.document_filename === 'string' ? p.document_filename : undefined,
              };
              onCitation(c);
              break; }
            case 'error':
              onError({
                code: typeof data.code === 'string' ? data.code : 'unknown',
                message: typeof data.message === 'string' ? data.message : 'Unknown error',
              });
              break;
            case 'truncated':
              onTruncated?.();
              break;
            case 'done':
              receivedDone = true;
              onDone({
                message_id: typeof data.message_id === 'string' ? data.message_id : '',
                can_continue: data.can_continue === true,
                continuation_count: typeof data.continuation_count === 'number' ? data.continuation_count : undefined,
              });
              break;
            default:
              // ignore pings and unknown events
              break;
          }
        } catch (e) {
          if (signal?.aborted) return;
          onError({ code: 'parse_error', message: String(e) });
        }
      }
    }
  } catch (e) {
    if (signal?.aborted) return;
    onError({ code: 'stream_error', message: String(e) });
  }

  if (!receivedDone && !signal?.aborted) {
    onTruncated?.();
    onDone({ message_id: '' });
  }
}

export async function chatStream(
  sessionId: string,
  message: string,
  onToken: (p: TokenPayload) => void,
  onCitation: (c: Citation) => void,
  onError: (e: ErrorPayload) => void,
  onDone: (d: DonePayload) => void,
  onTruncated?: () => void,
  mode?: string,
  locale?: string,
  signal?: AbortSignal,
) {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, ...(mode ? { mode } : {}), ...(locale ? { locale } : {}) }),
    signal,
  });

  if (!res.ok || !res.body) {
    if (signal?.aborted) return;
    const msg = await res.text().catch(() => '');
    onError({ code: 'http_error', message: `HTTP ${res.status}: ${msg}` });
    return;
  }

  const reader = res.body.getReader();
  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, signal);
}

export async function continueStream(
  sessionId: string,
  messageId: string,
  onToken: (p: TokenPayload) => void,
  onCitation: (c: Citation) => void,
  onError: (e: ErrorPayload) => void,
  onDone: (d: DonePayload) => void,
  onTruncated?: () => void,
  mode?: string,
  locale?: string,
  signal?: AbortSignal,
) {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message_id: messageId || undefined,
      ...(mode ? { mode } : {}),
      ...(locale ? { locale } : {}),
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    if (signal?.aborted) return;
    const msg = await res.text().catch(() => '');
    onError({ code: 'http_error', message: `HTTP ${res.status}: ${msg}` });
    return;
  }

  const reader = res.body.getReader();
  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, signal);
}
