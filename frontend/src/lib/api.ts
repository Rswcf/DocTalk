import type { DocumentResponse, Message, SearchResponse, Citation, SessionListResponse, CollectionBrief, CollectionDetail, NormalizedBBox, ExtractionJob, ExtractionTemplate, DocumentTable, QuestionTemplate, DocumentHierarchicalBrief, ChatArtifact } from '../types';
import type { UserProfile, CreditHistoryResponse, UsageBreakdown } from '../types';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
export const PROXY_BASE = '/api/proxy';

/**
 * Structured error thrown by `handle()` for any non-2xx response.
 *
 * Wire contract (docs/ARCHITECTURE.md §10, coming in Phase 6):
 * - `status`: HTTP status code (e.g. 403).
 * - `code`: the canonical `detail.error` string from the backend, or null
 *   if the body wasn't a JSON object with a string `error` field.
 * - `detail`: the parsed `detail` object (or parsed body itself if the
 *   backend didn't wrap it), or `{}` when parsing failed.
 * - `raw`: the raw response body, verbatim.
 *
 * `message` MUST stay in the exact `HTTP <status>: <raw>` shape because
 * legacy substring consumers still depend on it during the deprecation
 * window (BillingPageClient regex at BillingPageClient.tsx:157-168,
 * useChatStream HTTP/phrase matches at useChatStream.ts:95-114). Do not
 * "simplify" the message format until Phase 5 ships.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    public readonly detail: Record<string, unknown>,
    public readonly raw: string,
  ) {
    super(`HTTP ${status}: ${raw}`);
    this.name = 'ApiError';
  }
}

/**
 * Read the response body and throw a structured `ApiError`. Shared by
 * `handle()`, `exportSession()`, and other helpers that don't fit the
 * `res.json()` shape. Always throws — return type is `never`.
 */
async function throwApiError(res: Response): Promise<never> {
  const raw = await res.text();
  let code: string | null = null;
  let detail: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    // FastAPI HTTPException bodies are `{ detail: {...} }` or `{ detail: "..." }`.
    // Earlier taxonomy rows used the whole body as the detail object.
    const d = (parsed && typeof parsed === 'object' && 'detail' in parsed)
      ? (parsed as Record<string, unknown>).detail
      : parsed;
    if (d && typeof d === 'object') {
      detail = d as Record<string, unknown>;
      const errField = (d as Record<string, unknown>).error;
      if (typeof errField === 'string') code = errField;
    }
  } catch {
    // non-JSON body (proxy HTML 502, network error upstream) → code stays null
  }
  throw new ApiError(res.status, code, detail, raw);
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    await throwApiError(res);
  }
  return res.json();
}

export function mapCitationPayload(c: any): Citation {
  return {
    refIndex: c.ref_index ?? c.refIndex,
    chunkId: c.chunk_id ?? c.chunkId,
    page: c.page,
    pageEnd: typeof c.page_end === 'number' ? c.page_end : (typeof c.pageEnd === 'number' ? c.pageEnd : undefined),
    bboxes: c.bboxes || [],
    textSnippet: c.text_snippet ?? c.textSnippet ?? '',
    offset: c.offset ?? 0,
    documentId: typeof c.document_id === 'string' ? c.document_id : (typeof c.documentId === 'string' ? c.documentId : undefined),
    documentFilename: typeof c.document_filename === 'string' ? c.document_filename : (typeof c.documentFilename === 'string' ? c.documentFilename : undefined),
    confidenceScore: typeof c.confidence_score === 'number' ? c.confidence_score : (typeof c.confidenceScore === 'number' ? c.confidenceScore : undefined),
    contextText: typeof c.context_text === 'string' ? c.context_text : (typeof c.contextText === 'string' ? c.contextText : undefined),
  };
}

export function mapArtifactPayload(raw: any): ChatArtifact {
  const citations = Array.isArray(raw?.citations) ? raw.citations.map(mapCitationPayload) : [];
  return {
    artifactType: raw?.artifact_type ?? raw?.artifactType ?? 'artifact',
    status: raw?.status ?? 'queued',
    jobId: raw?.job_id ?? raw?.jobId ?? null,
    title: raw?.title ?? 'Artifact',
    summary: raw?.summary ?? '',
    preview: raw?.preview,
    downloadUrls: Array.isArray(raw?.download_urls) ? raw.download_urls : (Array.isArray(raw?.downloadUrls) ? raw.downloadUrls : []),
    citations,
    warning: raw?.warning ?? null,
    requiredPlan: raw?.required_plan ?? raw?.requiredPlan ?? null,
  };
}

export interface DocumentBrief {
  id: string;
  filename: string;
  status: string;
  created_at: string | null;
}

export async function getMyDocuments(signal?: AbortSignal): Promise<DocumentBrief[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents`, { signal });
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
  if (!tokenRes.ok) await throwApiError(tokenRes);
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

export async function getDocumentBrief(docId: string): Promise<DocumentHierarchicalBrief> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/brief`);
  return handle(res);
}

export async function getDocumentFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url`);
  return handle(res);
}

export async function getConvertedFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url?variant=converted`);
  return handle(res);
}

export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string; demo_messages_used?: number }>
{
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/sessions`, {
    method: 'POST',
  });
  return handle(res);
}

export async function getMessages(sessionId: string): Promise<{ messages: Message[] }> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/messages`);
  const data: { messages: Array<{ id?: string; share_anchor?: string; role: Message['role']; content: string; citations?: any[]; metadata_json?: any; created_at: string }> } = await handle(res);

  const mapped = (data.messages || []).map((m, idx) => {
    const citations: Citation[] | undefined = m.citations
      ? m.citations.map(mapCitationPayload)
      : undefined;
    const artifacts = Array.isArray(m.metadata_json?.artifacts)
      ? m.metadata_json.artifacts.map(mapArtifactPayload)
      : undefined;

    return {
      id: m.id ? `msg_${m.id}` : `msg_${idx}`,
      role: m.role,
      text: m.content,
      citations,
      artifacts,
      createdAt: Date.parse(m.created_at),
      backendId: m.id,
      shareAnchor: m.share_anchor,
    } as Message;
  });

  return { messages: mapped };
}

export interface DocumentJobDetail {
  id: string;
  document_id: string | null;
  collection_id: string | null;
  job_type: string;
  status: string;
  artifact: ChatArtifact;
}

export async function getDocumentJob(jobId: string): Promise<DocumentJobDetail> {
  const res = await fetch(`${PROXY_BASE}/api/document-jobs/${jobId}`);
  const data: any = await handle(res);
  return {
    ...data,
    artifact: mapArtifactPayload(data.artifact),
  };
}

export async function searchDocument(docId: string, query: string, topK?: number): Promise<SearchResponse> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  });
  return handle(res);
}

export interface ChunkDetail {
  chunk_id: string;
  page_start: number;
  bboxes: NormalizedBBox[] | null;
  text: string;
  section_title: string | null;
}

export async function getChunkDetail(chunkId: string): Promise<ChunkDetail> {
  const res = await fetch(`${PROXY_BASE}/api/chunks/${chunkId}`);
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

interface CreateSubscriptionParams {
  plan?: string;
  billing?: string;
  source?: string;
  reason?: string | null;
}

export async function createSubscription(params?: CreateSubscriptionParams): Promise<{ checkout_url: string }> {
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

export interface ChangePlanResult {
  status: 'upgraded' | 'downgraded';
  new_plan: string;
  effective: string;
  credits_supplemented: number;
}

export async function changePlan(params: { plan: string; billing: string }): Promise<ChangePlanResult> {
  const res = await fetch(PROXY_BASE + '/api/billing/change-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handle(res);
}

export interface CancelSubscriptionResult {
  status: 'scheduled_cancel' | 'immediate_revert';
  effective_at: string | null;
  message: string;
  refund_requested: boolean;
}

export type CancelSubscriptionReason =
  | 'not_a_fit'
  | 'answer_quality'
  | 'pdf_or_parsing'
  | 'too_expensive'
  | 'temporary_need'
  | 'missing_feature'
  | 'found_alternative'
  | 'other';

export interface CancelSubscriptionParams {
  reason?: CancelSubscriptionReason | null;
  feedback?: string;
  refund_requested?: boolean;
}

export async function cancelSubscription(params: CancelSubscriptionParams = {}): Promise<CancelSubscriptionResult> {
  const res = await fetch(PROXY_BASE + '/api/billing/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
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
  if (!res.ok) await throwApiError(res);
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

// --- Export API ---

export async function exportSession(sessionId: string, format: 'pdf' | 'docx'): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/export?format=${format}`);
  if (!res.ok) await throwApiError(res);
  return res.blob();
}

// --- Share API ---

export async function createShare(sessionId: string): Promise<{ share_token: string; url: string }> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/share`, { method: 'POST' });
  return handle(res);
}

export async function revokeShare(sessionId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/share`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(await res.text());
}

// --- Feedback API ---

export interface FeedbackRequest {
  type: 'feature_request' | 'bug' | 'answer_quality' | 'citation_problem' | 'billing_pricing' | 'usability' | 'other';
  area: 'upload_parse' | 'chat_answer' | 'citation_jump' | 'collections' | 'export' | 'billing' | 'account' | 'performance' | 'mobile' | 'localization';
  severity: 'low' | 'medium' | 'high' | 'blocking';
  selected_options: string[];
  message?: string | null;
  path?: string | null;
  locale?: string | null;
  plan?: string | null;
}

export interface FeedbackResponse {
  id: string;
  status: 'received';
}

export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  const res = await fetch(`${PROXY_BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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

export interface AdminBillingPriceStatus {
  label: string;
  configured: boolean;
  id_hint: string | null;
  livemode: boolean | null;
  active: boolean | null;
  currency: string | null;
  interval: string | null;
  error: string | null;
}

export interface AdminBillingHealth {
  stripe_secret_configured: boolean;
  stripe_secret_mode: 'missing' | 'live' | 'test' | 'unknown';
  stripe_webhook_configured: boolean;
  frontend_url_configured: boolean;
  all_subscription_prices_configured: boolean;
  remote_checked: boolean;
  has_mode_mismatch: boolean;
  prices: AdminBillingPriceStatus[];
}

export async function getAdminBillingHealth(remote = false): Promise<AdminBillingHealth> {
  const res = await fetch(`${PROXY_BASE}/api/admin/billing-health?remote=${remote ? 'true' : 'false'}`);
  return handle(res);
}

export interface AdminFunnelStage {
  key: string;
  label: string;
  users: number;
}

export interface AdminFunnelReason {
  event_name: string;
  reason: string | null;
  source: string | null;
  plan: string | null;
  label: string | null;
  description: string | null;
  events: number;
  users: number;
}

export interface AdminFunnel {
  days: number;
  since: string;
  cohort?: string;
  event_tracking_started_at: string | null;
  stages: AdminFunnelStage[];
  event_counts: Record<string, { events: number; users: number }>;
  reasons: AdminFunnelReason[];
}

export async function getAdminFunnel(days = 30): Promise<AdminFunnel> {
  const res = await fetch(`${PROXY_BASE}/api/admin/funnel?days=${days}`);
  return handle(res);
}

export interface AdminRagQualityRecent {
  created_at: string | null;
  status: string;
  status_label: string;
  score: number;
  route: string | null;
  route_label: string;
  strategy: string | null;
  strategy_label: string;
  main_issue: AdminRagQualityIssue | null;
  claim_count: number;
  citation_count: number;
  uncited_claim_count: number;
  numeric_mismatch_citation_count: number;
}

export interface AdminRagQualityIssue {
  key: string;
  label: string;
  description: string;
  count?: number;
  affected_answers?: number;
}

export interface AdminRagQualityStrategy {
  key: string;
  label: string;
  description: string;
  answers: number;
  needs_review: number;
  needs_review_rate: number;
  average_score: number;
}

export interface AdminRagQuality {
  days: number;
  since: string;
  sample_limit: number;
  is_sampled: boolean;
  evaluated_answers: number;
  health_label: string;
  health_explanation: string;
  average_score: number;
  pass_rate: number;
  warn_rate: number;
  fail_rate: number;
  status_counts: Record<string, number>;
  uncited_claims: number;
  invalid_citations: number;
  low_overlap_citations: number;
  numeric_mismatch_citations: number;
  issue_breakdown: AdminRagQualityIssue[];
  strategy_breakdown: AdminRagQualityStrategy[];
  recent: AdminRagQualityRecent[];
}

export async function getAdminRagQuality(days = 30): Promise<AdminRagQuality> {
  const res = await fetch(`${PROXY_BASE}/api/admin/rag-quality?days=${days}`);
  return handle(res);
}

export interface AdminMetricDelta {
  current: number;
  previous: number;
  delta: number;
  delta_percent: number | null;
}

export interface AdminUserActivitySummary {
  dau: number;
  wau: number;
  mau: number;
  signups: number;
  activated_users: number;
  upload_users: number;
  chat_users: number;
  paid_users: number;
  total_users: number;
  free_to_paid_rate: number;
  deltas: Record<string, AdminMetricDelta>;
}

export interface AdminUserActivityPoint {
  date: string;
  signups: number;
  active_users: number;
  ai_active_users: number;
  uploads: number;
  upload_users: number;
  chat_users: number;
  messages: number;
  credits_spent: number;
  upgrade_nudge_shown: number;
  paywall_opened: number;
  limit_hit: number;
  billing_view: number;
  upgrade_click: number;
  checkout_created: number;
  checkout_completed: number;
  feedback_submissions: number;
}

export interface AdminUserActivityFunnelStage {
  key: string;
  label: string;
  users: number;
  rate_from_signup: number | null;
  rate_from_previous: number | null;
}

export interface AdminUserRetentionRow {
  cohort_date: string;
  cohort_size: number;
  d0: number;
  d1: number;
  d7: number;
  d30: number;
  d0_rate: number;
  d1_rate: number;
  d7_rate: number;
  d30_rate: number;
}

export interface AdminUserActivitySegmentItem {
  key: string;
  count: number;
  users: number | null;
}

export interface AdminPaidIntentReasonItem {
  event_name: string;
  reason: string | null;
  source: string | null;
  plan: string | null;
  label: string | null;
  description: string | null;
  events: number;
  users: number;
}

export interface AdminFeedbackRecentItem {
  id: string;
  created_at: string | null;
  type: string;
  area: string;
  severity: string;
  status: string;
  path: string | null;
  locale: string | null;
  plan: string | null;
  has_message: boolean;
  message_preview: string | null;
}

export interface AdminFeedbackSummary {
  total: number;
  by_type: AdminUserActivitySegmentItem[];
  by_area: AdminUserActivitySegmentItem[];
  by_severity: AdminUserActivitySegmentItem[];
  by_status: AdminUserActivitySegmentItem[];
  recent: AdminFeedbackRecentItem[];
}

export interface AdminUserActivity {
  days: number;
  period: string;
  since: string;
  generated_at: string;
  summary: AdminUserActivitySummary;
  series: AdminUserActivityPoint[];
  funnel: AdminUserActivityFunnelStage[];
  retention: AdminUserRetentionRow[];
  retention_explanation: string | null;
  segments: {
    plan_distribution: AdminUserActivitySegmentItem[];
    file_types: AdminUserActivitySegmentItem[];
    paid_intent_reasons: AdminPaidIntentReasonItem[];
    conversion_blockers: AdminPaidIntentReasonItem[];
  };
  feedback: AdminFeedbackSummary;
}

export async function getAdminUserActivity(
  days = 30,
  period: 'day' | 'week' | 'month' = 'day',
): Promise<AdminUserActivity> {
  const res = await fetch(`${PROXY_BASE}/api/admin/user-activity?period=${period}&days=${days}`);
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

// --- Structured Extraction API ---

export async function listExtractionTemplates(): Promise<ExtractionTemplate[]> {
  const res = await fetch(`${PROXY_BASE}/api/extraction-templates`);
  return handle(res);
}

export async function listDocumentExtractions(documentId: string): Promise<ExtractionJob[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${documentId}/extractions`);
  return handle(res);
}

export async function createExtraction(params: {
  documentId: string;
  templateKey: string;
  locale?: string;
  domainMode?: 'legal' | 'academic' | null;
}): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${params.documentId}/extractions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_key: params.templateKey,
      locale: params.locale,
      domain_mode: params.domainMode || null,
    }),
  });
  return handle(res);
}

export async function getExtraction(jobId: string): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/extractions/${jobId}`);
  return handle(res);
}

export async function exportExtraction(jobId: string, format: 'md' | 'csv'): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE}/api/extractions/${jobId}/export?format=${format}`);
  if (!res.ok) await throwApiError(res);
  return res.blob();
}

// --- Table Extraction API ---

export async function scanDocumentTables(documentId: string): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${documentId}/tables/scan`, { method: 'POST' });
  return handle(res);
}

export async function listDocumentTables(documentId: string): Promise<DocumentTable[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${documentId}/tables`);
  return handle(res);
}

export async function getTableScanJob(jobId: string): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/document-table-scans/${jobId}`);
  return handle(res);
}

export async function exportDocumentTable(tableId: string): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE}/api/document-tables/${tableId}/export`);
  if (!res.ok) await throwApiError(res);
  return res.blob();
}

// --- Question Templates API ---

export async function listQuestionTemplates(): Promise<QuestionTemplate[]> {
  const res = await fetch(`${PROXY_BASE}/api/question-templates`);
  return handle(res);
}

export async function createQuestionTemplate(params: {
  name: string;
  description?: string | null;
  questions: string[];
}): Promise<QuestionTemplate> {
  const res = await fetch(`${PROXY_BASE}/api/question-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      description: params.description || null,
      questions: params.questions,
    }),
  });
  return handle(res);
}

export async function updateQuestionTemplate(params: {
  templateId: string;
  name: string;
  description?: string | null;
  questions: string[];
}): Promise<QuestionTemplate> {
  const res = await fetch(`${PROXY_BASE}/api/question-templates/${params.templateId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      description: params.description || null,
      questions: params.questions,
    }),
  });
  return handle(res);
}

export async function deleteQuestionTemplate(templateId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/api/question-templates/${templateId}`, { method: 'DELETE' });
  if (!res.ok) await throwApiError(res);
}

export async function listDocumentQuestionTemplateRuns(documentId: string): Promise<ExtractionJob[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${documentId}/question-template-runs`);
  return handle(res);
}

export async function runDocumentQuestionTemplate(params: {
  documentId: string;
  templateId: string;
  locale?: string;
}): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${params.documentId}/question-template-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: params.templateId, locale: params.locale }),
  });
  return handle(res);
}

export async function listCollectionQuestionTemplateRuns(collectionId: string): Promise<ExtractionJob[]> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${collectionId}/question-template-runs`);
  return handle(res);
}

export async function runCollectionQuestionTemplate(params: {
  collectionId: string;
  templateId: string;
  locale?: string;
}): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/collections/${params.collectionId}/question-template-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: params.templateId, locale: params.locale }),
  });
  return handle(res);
}

export async function getQuestionTemplateRun(jobId: string): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/question-template-runs/${jobId}`);
  return handle(res);
}

export async function exportQuestionTemplateRun(jobId: string, format: 'md' | 'csv'): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE}/api/question-template-runs/${jobId}/export?format=${format}`);
  if (!res.ok) await throwApiError(res);
  return res.blob();
}

// --- Document Diff API ---

export async function listDocumentDiffRuns(collectionId?: string): Promise<ExtractionJob[]> {
  const query = collectionId ? `?collection_id=${encodeURIComponent(collectionId)}` : '';
  const res = await fetch(`${PROXY_BASE}/api/document-diffs${query}`);
  return handle(res);
}

export async function runDocumentDiff(params: {
  oldDocumentId: string;
  newDocumentId: string;
  collectionId?: string;
  locale?: string;
}): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/document-diffs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      old_document_id: params.oldDocumentId,
      new_document_id: params.newDocumentId,
      collection_id: params.collectionId || null,
      locale: params.locale,
    }),
  });
  return handle(res);
}

export async function getDocumentDiffRun(jobId: string): Promise<ExtractionJob> {
  const res = await fetch(`${PROXY_BASE}/api/document-diffs/${jobId}`);
  return handle(res);
}

export async function exportDocumentDiffRun(jobId: string, format: 'md' | 'csv'): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE}/api/document-diffs/${jobId}/export?format=${format}`);
  if (!res.ok) await throwApiError(res);
  return res.blob();
}
