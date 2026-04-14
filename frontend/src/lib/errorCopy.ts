import type { ApiError } from './api';

export interface ErrorCopy {
  /** Short, one-line summary — suitable for toast title / inline heading. */
  title: string;
  /** Optional longer body with remediation detail + interpolated context. */
  body: string;
  /** Optional CTA button (e.g., upgrade or delete-docs link). */
  cta?: { label: string; href: string };
  severity: 'error' | 'warning' | 'info';
  /**
   * Whether the consumer should auto-open the paywall modal.
   * Only true for 402 INSUFFICIENT_CREDITS and SSE MODE_NOT_ALLOWED
   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
   */
  openPaywall?: boolean;
}

type TFn = (key: string, params?: Record<string, string | number>) => string;
type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;

/**
 * Minimal shape the mapper needs. Callers pass either an `ApiError`
 * (from api.ts), an SSE `{ code, message, status? }` frame (from sse.ts
 * error event), or any thrown value (falls through to generic copy).
 */
interface ErrLike {
  code?: unknown;
  status?: unknown;
  detail?: unknown;
  message?: unknown;
}

type ErrorInput = ApiError | ErrLike | unknown;

function extract(err: ErrorInput): { code: string | null; status: number | null; detail: Record<string, unknown> } {
  if (err && typeof err === 'object') {
    const e = err as ErrLike;
    const rawDetail = e.detail;
    const detail = (rawDetail && typeof rawDetail === 'object')
      ? (rawDetail as Record<string, unknown>)
      : {};
    return {
      code: typeof e.code === 'string' ? e.code : null,
      status: typeof e.status === 'number' ? e.status : null,
      detail,
    };
  }
  return { code: null, status: null, detail: {} };
}

export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
  // Kept for signature symmetry with existing i18n call-sites.
  void t;

  const { code, status, detail } = extract(err);

  // Dispatch by canonical code first; fall through by status; finally generic network.
  if (code) {
    const handler = CODE_TABLE[code];
    if (handler) return handler(detail, tOr);
  }

  if (status != null) {
    const statusHandler = STATUS_TABLE[status];
    if (statusHandler) return statusHandler(detail, tOr);
  }

  return {
    title: tOr('errors.NETWORK.title', 'Connection issue'),
    body: tOr('errors.NETWORK.body', 'Something went wrong. Please check your connection and try again.'),
    severity: 'error',
  };
}

// ────────────────────────────────────────────────────────────────────
// Code handlers — one per wire code. Keep these pure + declarative.
// ────────────────────────────────────────────────────────────────────

type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;

const CODE_TABLE: Record<string, Handler> = {
  // ─── Upload ───
  DOCUMENT_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
    body: tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
      limit: String(d.limit ?? ''),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),
  FILE_TOO_LARGE: (d, tOr) => ({
    title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
    body: tOr('errors.FILE_TOO_LARGE.body', 'Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.', {
      maxMb: String(d.max_mb ?? ''),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),
  UNSUPPORTED_FORMAT: (_d, tOr) => ({
    title: tOr('errors.UNSUPPORTED_FORMAT.title', 'Unsupported file format'),
    body: tOr('errors.UNSUPPORTED_FORMAT.body', 'Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.'),
    severity: 'error',
  }),
  INVALID_FILE_CONTENT: (_d, tOr) => ({
    title: tOr('errors.INVALID_FILE_CONTENT.title', 'File content invalid'),
    body: tOr('errors.INVALID_FILE_CONTENT.body', 'The file doesn\'t match its declared format, or appears corrupted.'),
    severity: 'error',
  }),

  // ─── URL ingest ───
  URL_INVALID: (_d, tOr) => ({
    title: tOr('errors.URL_INVALID.title', 'Invalid URL'),
    body: tOr('errors.URL_INVALID.body', 'Enter a full URL starting with http:// or https://.'),
    severity: 'error',
  }),
  URL_FETCH_BLOCKED: (_d, tOr) => ({
    title: tOr('errors.URL_FETCH_BLOCKED.title', 'URL can\'t be imported'),
    body: tOr('errors.URL_FETCH_BLOCKED.body', 'This URL can\'t be fetched. Try a public web page.'),
    severity: 'error',
  }),
  URL_CONTENT_TOO_LARGE: (_d, tOr) => ({
    title: tOr('errors.URL_CONTENT_TOO_LARGE.title', 'Page too large'),
    body: tOr('errors.URL_CONTENT_TOO_LARGE.body', 'The page is too large to import.'),
    severity: 'error',
  }),
  NO_TEXT_CONTENT: (_d, tOr) => ({
    title: tOr('errors.NO_TEXT_CONTENT.title', 'No text on page'),
    body: tOr('errors.NO_TEXT_CONTENT.body', 'No readable text was found on this page.'),
    severity: 'error',
  }),
  URL_FETCH_FAILED: (_d, tOr) => ({
    title: tOr('errors.URL_FETCH_FAILED.title', 'URL fetch failed'),
    body: tOr('errors.URL_FETCH_FAILED.body', 'Couldn\'t fetch the URL. Try again later.'),
    severity: 'error',
  }),

  // ─── Document state ───
  DOCUMENT_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.DOCUMENT_NOT_FOUND.title', 'Document not found'),
    body: tOr('errors.DOCUMENT_NOT_FOUND.body', 'This document doesn\'t exist or isn\'t yours.'),
    severity: 'error',
  }),
  DOCUMENT_PROCESSING: (_d, tOr) => ({
    title: tOr('errors.DOCUMENT_PROCESSING.title', 'Still processing'),
    body: tOr('errors.DOCUMENT_PROCESSING.body', 'The document is still being processed. Try again in a moment.'),
    severity: 'info',
  }),
  STORAGE_UNAVAILABLE: (_d, tOr) => ({
    title: tOr('errors.STORAGE_UNAVAILABLE.title', 'Storage unavailable'),
    body: tOr('errors.STORAGE_UNAVAILABLE.body', 'Document storage is temporarily unavailable. Please try again shortly.'),
    severity: 'error',
  }),
  INSTRUCTIONS_TOO_LONG: (d, tOr) => ({
    title: tOr('errors.INSTRUCTIONS_TOO_LONG.title', 'Instructions too long'),
    body: tOr('errors.INSTRUCTIONS_TOO_LONG.body', 'Custom instructions are limited to {max} characters.', {
      max: String(d.max ?? 2000),
    }),
    severity: 'warning',
  }),
  CUSTOM_INSTRUCTIONS_REQUIRE_PRO: (_d, tOr) => ({
    title: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title', 'Pro plan required'),
    body: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body', 'Custom instructions are available on the Pro plan.'),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),

  // ─── Sessions / chat ───
  SESSION_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.SESSION_LIMIT_REACHED.title', 'Session limit reached'),
    body: tOr('errors.SESSION_LIMIT_REACHED.body', 'Free plan is limited to {limit} chat sessions per document. Upgrade for unlimited.', {
      limit: String(d.limit ?? ''),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),
  SESSION_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.SESSION_NOT_FOUND.title', 'Session not found'),
    body: tOr('errors.SESSION_NOT_FOUND.body', 'This chat session doesn\'t exist or isn\'t yours.'),
    severity: 'error',
  }),
  MESSAGE_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.MESSAGE_NOT_FOUND.title', 'Message not found'),
    body: tOr('errors.MESSAGE_NOT_FOUND.body', 'The referenced message no longer exists.'),
    severity: 'error',
  }),
  RATE_LIMITED: (d, tOr) => ({
    title: tOr('errors.RATE_LIMITED.title', 'Too many requests'),
    body: tOr('errors.RATE_LIMITED.body', 'Please slow down and try again in {retryAfter}s.', {
      retryAfter: String(d.retry_after ?? 60),
    }),
    severity: 'warning',
  }),
  DEMO_SESSION_RATE_LIMITED: (d, tOr) => ({
    title: tOr('errors.DEMO_SESSION_RATE_LIMITED.title', 'Too many demo sessions'),
    body: tOr('errors.DEMO_SESSION_RATE_LIMITED.body', 'Please wait {retryAfter}s before creating another demo session.', {
      retryAfter: String(d.retry_after ?? 300),
    }),
    severity: 'warning',
  }),
  DEMO_SESSION_LIMIT_REACHED: (_d, tOr) => ({
    title: tOr('errors.DEMO_SESSION_LIMIT_REACHED.title', 'Demo limit reached'),
    body: tOr('errors.DEMO_SESSION_LIMIT_REACHED.body', 'This demo document has reached its session capacity. Try again later.'),
    severity: 'warning',
  }),
  DEMO_MESSAGE_LIMIT_REACHED: (_d, tOr) => ({
    title: tOr('errors.DEMO_MESSAGE_LIMIT_REACHED.title', 'Demo limit reached'),
    body: tOr('errors.DEMO_MESSAGE_LIMIT_REACHED.body', 'You\'ve used all demo messages. Sign in to upload your own documents.'),
    cta: { label: tOr('errors.cta.signin', 'Sign in'), href: '/auth' },
    severity: 'info',
  }),
  INSUFFICIENT_CREDITS: (d, tOr) => ({
    title: tOr('errors.INSUFFICIENT_CREDITS.title', 'Out of credits'),
    body: tOr('errors.INSUFFICIENT_CREDITS.body', 'You need {required} credits but only have {balance}. Top up or upgrade.', {
      required: String(d.required ?? ''),
      balance: String(d.balance ?? ''),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
    openPaywall: true,
  }),
  CONTINUATION_LIMIT: (d, tOr) => ({
    title: tOr('errors.CONTINUATION_LIMIT.title', 'Continue limit reached'),
    body: tOr('errors.CONTINUATION_LIMIT.body', 'You can only continue a response {max} times.', {
      max: String(d.max ?? 3),
    }),
    severity: 'info',
  }),
  MODE_NOT_ALLOWED: (_d, tOr) => ({
    title: tOr('errors.MODE_NOT_ALLOWED.title', 'Plus plan required'),
    body: tOr('errors.MODE_NOT_ALLOWED.body', 'Thorough mode is available on the Plus plan.'),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
    openPaywall: true,
  }),

  // ─── Collections ───
  COLLECTION_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.COLLECTION_LIMIT_REACHED.title', 'Collection limit reached'),
    body: tOr('errors.COLLECTION_LIMIT_REACHED.body', 'Your plan allows up to {limit} collections. Upgrade for more.', {
      limit: String(d.limit ?? ''),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),
  COLLECTION_DOC_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.COLLECTION_DOC_LIMIT_REACHED.title', 'Too many documents'),
    body: tOr('errors.COLLECTION_DOC_LIMIT_REACHED.body', 'Your plan allows up to {limit} documents per collection. Upgrade for more.', {
      limit: String(d.limit ?? ''),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),
  COLLECTION_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.COLLECTION_NOT_FOUND.title', 'Collection not found'),
    body: tOr('errors.COLLECTION_NOT_FOUND.body', 'This collection doesn\'t exist or isn\'t yours.'),
    severity: 'error',
  }),

  // ─── Export ───
  EXPORT_REQUIRES_PAID_PLAN: (d, tOr) => ({
    title: tOr('errors.EXPORT_REQUIRES_PAID_PLAN.title', 'Paid plan required'),
    body: tOr('errors.EXPORT_REQUIRES_PAID_PLAN.body', '{format} export requires a Plus or Pro plan.', {
      format: String(d.format ?? 'PDF/DOCX').toUpperCase(),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),
  EXPORT_VALIDATION_FAILED: (_d, tOr) => ({
    title: tOr('errors.EXPORT_VALIDATION_FAILED.title', 'Export failed'),
    body: tOr('errors.EXPORT_VALIDATION_FAILED.body', 'Couldn\'t build the export — this session may have too many messages.'),
    severity: 'error',
  }),
  EXPORT_RENDERER_FAILED: (_d, tOr) => ({
    title: tOr('errors.EXPORT_RENDERER_FAILED.title', 'Export failed'),
    body: tOr('errors.EXPORT_RENDERER_FAILED.body', 'The export couldn\'t be generated. Please try again.'),
    severity: 'error',
  }),

  // ─── Sharing ───
  SHARE_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.SHARE_LIMIT_REACHED.title', 'Share limit reached'),
    body: tOr('errors.SHARE_LIMIT_REACHED.body', 'Free plan is limited to {limit} active share links. Upgrade for unlimited.', {
      limit: String(d.limit ?? 3),
    }),
    cta: { label: tOr('errors.cta.upgrade', 'Upgrade'), href: '/pricing' },
    severity: 'warning',
  }),
  SHARE_EXPIRED: (_d, tOr) => ({
    title: tOr('errors.SHARE_EXPIRED.title', 'Share expired'),
    body: tOr('errors.SHARE_EXPIRED.body', 'This share link has expired.'),
    severity: 'info',
  }),
  SHARE_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.SHARE_NOT_FOUND.title', 'Share not found'),
    body: tOr('errors.SHARE_NOT_FOUND.body', 'This share link is invalid or has been revoked.'),
    severity: 'error',
  }),

  // ─── Chunks / users ───
  CHUNK_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.CHUNK_NOT_FOUND.title', 'Passage not found'),
    body: tOr('errors.CHUNK_NOT_FOUND.body', 'The requested passage no longer exists.'),
    severity: 'error',
  }),
  STRIPE_UNAVAILABLE: (_d, tOr) => ({
    title: tOr('errors.STRIPE_UNAVAILABLE.title', 'Billing unavailable'),
    body: tOr('errors.STRIPE_UNAVAILABLE.body', 'Billing is temporarily unavailable. Please try again shortly.'),
    severity: 'error',
  }),

  // ─── SSE-only codes (already-structured from Phase 1) ───
  CHAT_SETUP_ERROR: (_d, tOr) => ({
    title: tOr('errors.CHAT_SETUP_ERROR.title', 'Chat setup failed'),
    body: tOr('errors.CHAT_SETUP_ERROR.body', 'Couldn\'t start the chat. Please try again.'),
    severity: 'error',
  }),
  RETRIEVAL_ERROR: (_d, tOr) => ({
    title: tOr('errors.RETRIEVAL_ERROR.title', 'Retrieval failed'),
    body: tOr('errors.RETRIEVAL_ERROR.body', 'Document search failed. Please try again.'),
    severity: 'error',
  }),
  LLM_ERROR: (_d, tOr) => ({
    title: tOr('errors.LLM_ERROR.title', 'Response failed'),
    body: tOr('errors.LLM_ERROR.body', 'The AI didn\'t respond. Please try again.'),
    severity: 'error',
  }),
  ACCOUNTING_ERROR: (_d, tOr) => ({
    title: tOr('errors.ACCOUNTING_ERROR.title', 'Accounting issue'),
    body: tOr('errors.ACCOUNTING_ERROR.body', 'An internal credit-accounting issue occurred. Your credits are safe.'),
    severity: 'warning',
  }),
  PERSIST_FAILED: (_d, tOr) => ({
    title: tOr('errors.PERSIST_FAILED.title', 'Save failed'),
    body: tOr('errors.PERSIST_FAILED.body', 'Couldn\'t save the response. Please try again.'),
    severity: 'error',
  }),

  // ─── Server / generic ───
  SERVER_ERROR: (_d, tOr) => ({
    title: tOr('errors.SERVER_ERROR.title', 'Server error'),
    body: tOr('errors.SERVER_ERROR.body', 'An internal error occurred. We\'ve logged it.'),
    severity: 'error',
  }),
};

// Fallback by status when no recognized code is present (network-layer,
// third-party proxy 502, etc.).
const STATUS_TABLE: Record<number, Handler> = {
  401: (_d, tOr) => ({
    title: tOr('errors.status.401.title', 'Sign in required'),
    body: tOr('errors.status.401.body', 'Please sign in to continue.'),
    cta: { label: tOr('errors.cta.signin', 'Sign in'), href: '/auth' },
    severity: 'info',
  }),
  403: (_d, tOr) => ({
    title: tOr('errors.status.403.title', 'Not allowed'),
    body: tOr('errors.status.403.body', 'You don\'t have access to this.'),
    severity: 'error',
  }),
  404: (_d, tOr) => ({
    title: tOr('errors.status.404.title', 'Not found'),
    body: tOr('errors.status.404.body', 'The item you\'re looking for doesn\'t exist.'),
    severity: 'error',
  }),
  429: (_d, tOr) => ({
    title: tOr('errors.status.429.title', 'Too many requests'),
    body: tOr('errors.status.429.body', 'Please slow down and try again in a moment.'),
    severity: 'warning',
  }),
  502: (_d, tOr) => ({
    title: tOr('errors.status.502.title', 'Service unavailable'),
    body: tOr('errors.status.502.body', 'A dependency is temporarily unavailable. Please try again.'),
    severity: 'error',
  }),
  503: (_d, tOr) => ({
    title: tOr('errors.status.503.title', 'Service unavailable'),
    body: tOr('errors.status.503.body', 'The service is temporarily unavailable.'),
    severity: 'error',
  }),
};

// ────────────────────────────────────────────────────────────────────
// Worker-error bridge helper: parses `doc.error_msg` returned by
// /api/documents/{id}. Phase 2 writes "ERR_CODE:<CODE>:<text>" but
// legacy rows may still be free text.
// ────────────────────────────────────────────────────────────────────

export function parseWorkerErrorMsg(raw: string | null | undefined): { code: string | null; fallback: string } {
  if (!raw) return { code: null, fallback: '' };
  const match = raw.match(/^ERR_CODE:([A-Z_][A-Z0-9_]*):(.*)$/s);
  if (match) return { code: match[1], fallback: match[2] };
  return { code: null, fallback: raw };
}
