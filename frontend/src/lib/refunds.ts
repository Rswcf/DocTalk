import { ApiError, PROXY_BASE } from './api';

export type RefundRequestKind = 'commercial' | 'statutory' | 'other';
export type RefundStatus = 'eligible' | 'review' | 'reserved' | 'submitting' | 'cash_unknown' | 'cash_pending' | 'cash_failed' | 'cash_reversed' | 'cash_succeeded' | 'repair_required' | 'completed' | 'manual_unknown';
export interface RefundOption {
  invoice_id: string;
  amount_minor: number;
  currency: string;
  paid_at: string;
  subscription_id: string;
}
export interface RefundOptions {
  enabled: boolean;
  policy_version: string;
  options: RefundOption[];
}
export interface RefundOperation {
  id: string;
  invoice_id: string;
  status: RefundStatus;
  review_reason: string | null;
  amount_minor: number;
  currency: string;
  credits_to_revoke: number;
  policy_version: string;
  confirmation_required: boolean;
  cash_status: string | null;
  consequences: { ends_subscription_immediately: boolean; revokes_credits: number };
  created_at: string;
}
export interface RefundConfirmations {
  confirm_full_refund: boolean;
  confirm_immediate_cancellation: boolean;
  confirm_credit_revocation: boolean;
}

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(PROXY_BASE + '/api/billing/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new ApiError(response.status, null, {}, await response.text());
  return response.json();
}

/** A pre-feature backend is indistinguishable from the disabled feature in the UI. */
export async function getRefundOptions(): Promise<RefundOptions | null> {
  try {
    const options = await request<RefundOptions>('refund-options');
    return options.enabled === true ? options : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
export function createRefundRequest(invoiceId: string, kind: RefundRequestKind, reason: string): Promise<RefundOperation> {
  return request('refund-requests', { invoice_id: invoiceId, request_kind: kind, ...(reason.trim() ? { reason: reason.trim() } : {}) });
}
/** DB-only owned history remains readable while new automatic requests are disabled. */
export async function getRefundRequests(): Promise<RefundOperation[]> {
  try {
    return (await request<{ operations: RefundOperation[] }>('refund-requests')).operations;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}
export function getRefundRequest(id: string): Promise<RefundOperation> {
  return request('refund-requests/' + encodeURIComponent(id));
}
export function canConfirmRefund(operation: RefundOperation, checks: RefundConfirmations): boolean {
  return operation.status === 'eligible' && operation.confirmation_required === true
    && checks.confirm_full_refund === true && checks.confirm_immediate_cancellation === true
    && checks.confirm_credit_revocation === true;
}
export function confirmRefundRequest(operation: RefundOperation, checks: RefundConfirmations): Promise<RefundOperation> {
  if (!canConfirmRefund(operation, checks)) return Promise.reject(new Error('Refund confirmation incomplete'));
  return request(`refund-requests/${encodeURIComponent(operation.id)}/confirm`, checks);
}
export function formatRefundAmount(amount: number, currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}
