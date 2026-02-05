import type { DocumentResponse, Message, SearchResponse, Citation, SessionListResponse } from '../types';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
export const PROXY_BASE = '/api/proxy';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export interface DocumentBrief {
  id: string;
  filename: string;
  status: string;
  created_at: string | null;
}

export async function getMyDocuments(): Promise<DocumentBrief[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents?mine=1`);
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch documents: ${res.status}`);
  }
  return res.json();
}

export async function uploadDocument(file: File): Promise<{ document_id: string; status: string; filename?: string }>
{
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${PROXY_BASE}/api/documents/upload`, {
    method: 'POST',
    body: form,
  });
  return handle(res);
}

export async function getDocument(docId: string): Promise<DocumentResponse> {
  const res = await fetch(`${API_BASE}/api/documents/${docId}`);
  return handle(res);
}

export async function getDocumentFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(`${API_BASE}/api/documents/${docId}/file-url`);
  return handle(res);
}

export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string }>
{
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/sessions`, {
    method: 'POST',
  });
  return handle(res);
}

export async function getMessages(sessionId: string): Promise<{ messages: Message[] }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
  const data: { messages: Array<{ role: Message['role']; content: string; citations?: any[]; created_at: string }> } = await handle(res);

  const mapped = (data.messages || []).map((m, idx) => {
    const citations: Citation[] | undefined = m.citations
      ? m.citations.map((c: any) => ({
          refIndex: c.ref_index,
          chunkId: c.chunk_id,
          page: c.page,
          bboxes: c.bboxes || [],
          textSnippet: c.text_snippet,
          offset: c.offset,
        }))
      : undefined;

    return {
      id: `msg_${idx}`,
      role: m.role,
      text: m.content,
      citations,
      createdAt: Date.parse(m.created_at),
    } as Message;
  });

  return { messages: mapped };
}

export async function searchDocument(docId: string, query: string, topK?: number): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/documents/${docId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  });
  return handle(res);
}

export async function listSessions(docId: string): Promise<SessionListResponse> {
  const res = await fetch(`${API_BASE}/api/documents/${docId}/sessions`);
  return handle(res);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}
