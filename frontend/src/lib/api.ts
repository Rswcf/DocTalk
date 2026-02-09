import type { DocumentResponse, Message, SearchResponse, Citation, SessionListResponse, CollectionBrief, CollectionDetail } from '../types';
import type { UserProfile, CreditHistoryResponse, UsageBreakdown } from '../types';

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
  // Uploads bypass the Vercel proxy to avoid the 4.5MB serverless body limit.
  // 1. Obtain a short-lived backend JWT via the lightweight /api/upload-token endpoint
  // 2. POST the file directly to the Railway backend with that JWT
  const tokenRes = await fetch('/api/upload-token');
  if (!tokenRes.ok) {
    throw new Error(`Failed to get upload token: ${tokenRes.status}`);
  }
  const { token } = await tokenRes.json();

  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });
  return handle(res);
}

export async function getDocument(docId: string): Promise<DocumentResponse> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}`);
  return handle(res);
}

export async function getDocumentFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url`);
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
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/messages`);
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
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  });
  return handle(res);
}

export async function listSessions(docId: string): Promise<SessionListResponse> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/sessions`);
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

export async function getUserProfile(): Promise<UserProfile> {
  const res = await fetch(PROXY_BASE + '/api/users/profile');
  return handle(res);
}

export async function getCreditHistory(limit = 20, offset = 0): Promise<CreditHistoryResponse> {
  const res = await fetch(PROXY_BASE + '/api/credits/history?limit=' + limit + '&offset=' + offset);
  return handle(res);
}

export async function getUsageBreakdown(): Promise<UsageBreakdown> {
  const res = await fetch(PROXY_BASE + '/api/users/usage-breakdown');
  return handle(res);
}

export async function deleteUserAccount(): Promise<void> {
  const res = await fetch(PROXY_BASE + '/api/users/me', { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('HTTP ' + res.status + ': ' + text);
  }
}

export async function createSubscription(params?: { plan?: string; billing?: string }): Promise<{ checkout_url: string }> {
  const res = await fetch(PROXY_BASE + '/api/billing/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  return handle(res);
}

export async function createPortalSession(): Promise<{ portal_url: string }> {
  const res = await fetch(PROXY_BASE + '/api/billing/portal', { method: 'POST' });
  return handle(res);
}

export interface DemoDocument {
  slug: string;
  document_id: string;
  filename: string;
  status: string;
}

export async function updateDocumentInstructions(docId: string, instructions: string | null): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_instructions: instructions }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

export async function getDemoDocuments(): Promise<DemoDocument[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents/demo`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- Collections API ---

export async function listCollections(): Promise<CollectionBrief[]> {
  const res = await fetch(`${PROXY_BASE}/api/collections`);
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export async function createCollection(name: string, description?: string, documentIds?: string[]): Promise<{ id: string; name: string; created_at: string }> {
  const res = await fetch(`${PROXY_BASE}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, document_ids: documentIds }),
  });
  return handle(res);
}

export async function getCollection(collectionId: string): Promise<CollectionDetail> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${collectionId}`);
  return handle(res);
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${collectionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function addDocumentsToCollection(collectionId: string, documentIds: string[]): Promise<{ added: number }> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${collectionId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: documentIds }),
  });
  return handle(res);
}

export async function removeDocumentFromCollection(collectionId: string, documentId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${collectionId}/documents/${documentId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function createCollectionSession(collectionId: string): Promise<{ session_id: string; collection_id: string; title: string | null; created_at: string }> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${collectionId}/sessions`, { method: 'POST' });
  return handle(res);
}

export async function listCollectionSessions(collectionId: string): Promise<SessionListResponse> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${collectionId}/sessions`);
  return handle(res);
}

// --- Admin API ---

export async function getAdminOverview() {
  const res = await fetch(`${PROXY_BASE}/api/admin/overview`);
  return handle(res);
}

export async function getAdminTrends(period = 'day', days = 30) {
  const res = await fetch(`${PROXY_BASE}/api/admin/trends?period=${period}&days=${days}`);
  return handle(res);
}

export async function getAdminBreakdowns() {
  const res = await fetch(`${PROXY_BASE}/api/admin/breakdowns`);
  return handle(res);
}

export async function getAdminRecentUsers(limit = 20) {
  const res = await fetch(`${PROXY_BASE}/api/admin/recent-users?limit=${limit}`);
  return handle(res);
}

export async function getAdminTopUsers(limit = 20, by = 'tokens') {
  const res = await fetch(`${PROXY_BASE}/api/admin/top-users?limit=${limit}&by=${by}`);
  return handle(res);
}

// --- Data Export ---

export async function exportUserData(): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE}/api/users/me/export`);
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

// --- URL Ingestion ---

export async function ingestUrl(url: string): Promise<{ document_id: string; status: string; filename?: string }> {
  const res = await fetch(`${PROXY_BASE}/api/documents/ingest-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return handle(res);
}
