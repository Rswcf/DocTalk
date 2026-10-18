"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../i18n';
import { canConfirmRefund, confirmRefundRequest, createRefundRequest, formatRefundAmount, getRefundOptions, getRefundRequest, getRefundRequests, type RefundConfirmations, type RefundOperation, type RefundOptions, type RefundRequestKind } from '../lib/refunds';

const EMPTY_CHECKS: RefundConfirmations = { confirm_full_refund: false, confirm_immediate_cancellation: false, confirm_credit_revocation: false };
const INPUT = 'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const BUTTON = 'rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500';

export default function RefundPanel({ onCompleted, onAvailabilityChange }: { onCompleted: () => void; onAvailabilityChange: (enabled: boolean) => void }) {
  const { tOr, locale } = useLocale();
  const [options, setOptions] = useState<RefundOptions | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [kind, setKind] = useState<RefundRequestKind>('commercial');
  const [reason, setReason] = useState('');
  const [operation, setOperation] = useState<RefundOperation | null>(null);
  const [checks, setChecks] = useState<RefundConfirmations>(EMPTY_CHECKS);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState<RefundOperation[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const completedId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getRefundOptions(), getRefundRequests()]).then(([available, requests]) => {
      if (!active) return;
      const value = available.status === 'fulfilled' ? available.value : null;
      setOptions(value); onAvailabilityChange(value?.enabled === true);
      setInvoiceId(value?.options[0]?.invoice_id || '');
      if (requests.status === 'fulfilled') {
        setHistory(requests.value); setOperation(requests.value[0] || null); setHistoryLoaded(true);
      } else { setError(true); }
    });
    return () => { active = false; };
  }, [onAvailabilityChange]);

  useEffect(() => {
    const element = dialog.current;
    if (modalOpen && element && !element.open) element.showModal();
    else if (!modalOpen && element?.open) element.close();
  }, [modalOpen]);

  const updateOperation = useCallback((value: RefundOperation) => {
    setOperation(value);
    setHistory(previous => [value, ...previous.filter(item => item.id !== value.id)]);
    if (value.status === 'completed' && completedId.current !== value.id) {
      completedId.current = value.id;
      onCompleted();
    }
  }, [onCompleted]);

  async function run(action: () => Promise<RefundOperation>, openConfirmation = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const result = await action();
      updateOperation(result);
      if (openConfirmation && result.status === 'eligible' && result.confirmation_required) {
        setChecks(EMPTY_CHECKS); setModalOpen(true);
      }
    } catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  }

  if (!options?.enabled && !operation && history.length === 0) return null;
  const amount = operation ? formatRefundAmount(operation.amount_minor, operation.currency, locale) : '';
  const statusText: Record<RefundOperation['status'], string> = {
    eligible: tOr('billing.refund.status.eligible', 'Eligible. Confirm the consequences to submit your refund.'),
    review: tOr('billing.refund.status.review', 'Recorded for manual review. No automatic refund has been issued.'),
    reserved: tOr('billing.refund.status.processing', 'Your request is being processed. Refresh its status before taking another action.'),
    submitting: tOr('billing.refund.status.processing', 'Your request is being processed. Refresh its status before taking another action.'),
    cash_unknown: tOr('billing.refund.status.uncertain', 'The payment outcome needs verification. Do not submit another refund request.'),
    cash_pending: tOr('billing.refund.status.pending', 'The payment provider is processing the refund. It is not yet complete.'),
    cash_reversed: tOr('billing.refund.status.uncertain', 'The payment outcome needs verification. Do not submit another refund request.'),
    cash_failed: tOr('billing.refund.status.failed', 'The refund did not complete. Contact support for review.'),
    cash_succeeded: tOr('billing.refund.status.repair', 'The refund succeeded. Subscription and credit updates are still being completed.'),
    repair_required: tOr('billing.refund.status.uncertain', 'The payment outcome needs verification. Do not submit another refund request.'),
    completed: tOr('billing.refund.status.completed', 'Refund completed. The subscription ended and its unused credits were removed.'),
    manual_unknown: tOr('billing.refund.status.uncertain', 'The payment outcome needs verification. Do not submit another refund request.'),
  };

  return (
    <section aria-labelledby="refund-panel-title" className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 id="refund-panel-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{tOr('billing.refund.title', 'Refund requests')}</h2>
      {options?.enabled ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{tOr('billing.refund.policy', 'Automatic refunds are limited to an unused first monthly payment within 14 days, up to US$25, once per 365 days. Other requests receive manual review.')}</p> : null}
      {history.length ? <label className="mt-4 grid max-w-xl gap-1 text-sm text-zinc-700 dark:text-zinc-200">{tOr('billing.refund.reference', 'Request reference')}
        <select className={INPUT} value={operation?.id || ''} disabled={busy} onChange={event => { const selected = history.find(item => item.id === event.target.value); setOperation(selected || null); setError(false); }}>
          {options?.enabled ? <option value="">{tOr('billing.refund.request', 'Create refund request')}</option> : null}
          {history.map(item => <option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleDateString(locale)} · {item.id}</option>)}
        </select>
      </label> : null}
      {operation ? (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-sm text-zinc-700 dark:text-zinc-200">{statusText[operation.status] || tOr('billing.refund.status.uncertain', 'The payment outcome needs verification. Do not submit another refund request.')}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{amount} · {tOr('billing.refund.reference', 'Request reference')}: {operation.id}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} className={BUTTON} onClick={() => void run(() => getRefundRequest(operation.id))}>{tOr('billing.refund.refresh', 'Refresh status')}</button>
            {operation.status === 'eligible' && operation.confirmation_required ? <button type="button" disabled={busy} className={BUTTON} onClick={() => { setChecks(EMPTY_CHECKS); setModalOpen(true); }}>{tOr('billing.refund.preview', 'Review refund')}</button> : null}
          </div>
        </div>
      ) : !historyLoaded ? <p role="status" className="mt-3 text-sm">{tOr('billing.refund.error', 'We could not update this request. Refresh its status before trying again.')}</p> : options?.enabled && options.options.length ? (
        <form className="mt-4 grid max-w-xl gap-3" onSubmit={event => { event.preventDefault(); if (invoiceId) void run(() => createRefundRequest(invoiceId, kind, reason), true); }}>
          <label className="grid gap-1 text-sm text-zinc-700 dark:text-zinc-200">{tOr('billing.refund.payment', 'Payment')}
            <select value={invoiceId} onChange={event => setInvoiceId(event.target.value)} disabled={busy} className={INPUT}>
              {options.options.map(option => <option key={option.invoice_id} value={option.invoice_id}>{formatRefundAmount(option.amount_minor, option.currency, locale)} · {new Date(option.paid_at).toLocaleDateString(locale)} · {option.invoice_id}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-zinc-700 dark:text-zinc-200">{tOr('billing.refund.kind', 'Request type')}
            <select value={kind} onChange={event => setKind(event.target.value as RefundRequestKind)} disabled={busy} className={INPUT}>
              <option value="commercial">{tOr('billing.refund.commercial', 'Check automatic refund eligibility')}</option>
              <option value="statutory">{tOr('billing.refund.statutory', 'Statutory rights — manual review')}</option>
              <option value="other">{tOr('billing.refund.other', 'Other request — manual review')}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-zinc-700 dark:text-zinc-200">{tOr('billing.refund.reason', 'Reason (optional)')}
            <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={busy} className={INPUT} rows={3} />
          </label>
          <button type="submit" disabled={busy || !invoiceId} className={BUTTON}>{tOr('billing.refund.request', 'Create refund request')}</button>
        </form>
      ) : <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{tOr('billing.refund.noPayments', 'No payments are available here. Contact support to request a review of your rights.')}</p>}
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr('billing.refund.reviewOnly', 'The refund checkbox in the cancellation form only records a request for review. It does not issue a cash refund.')}</p>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{tOr('billing.refund.error', 'We could not update this request. Refresh its status before trying again.')}</p> : null}
      <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else setModalOpen(false); }} aria-labelledby="refund-confirm-title" className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
        <h3 id="refund-confirm-title" className="text-lg font-semibold">{tOr('billing.refund.preview', 'Review refund')}</h3>
        {operation ? <>
          <p className="mt-3 text-sm">{tOr('billing.refund.amount', 'Refund amount')}: {amount}</p>
          <p className="mt-2 text-sm">{tOr('billing.refund.credits', 'Unused credits to remove')}: {operation.consequences.revokes_credits.toLocaleString(locale)}</p>
          <p className="mt-2 text-sm">{tOr('billing.refund.cancelNow', 'The corresponding subscription will end immediately when this refund succeeds.')}</p>
          <div className="mt-5 grid gap-3">
            {([
              ['confirm_full_refund', 'billing.refund.confirmAmount', 'I confirm the full refund amount shown above.'],
              ['confirm_immediate_cancellation', 'billing.refund.confirmCancel', 'I agree to end the corresponding subscription immediately.'],
              ['confirm_credit_revocation', 'billing.refund.confirmCredits', 'I agree to remove the unused credits shown above.'],
            ] as const).map(([key, label, fallback]) => <label key={key} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={checks[key]} disabled={busy} onChange={event => setChecks(previous => ({ ...previous, [key]: event.target.checked }))} />{tOr(label, fallback)}</label>)}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" disabled={busy} className={BUTTON} onClick={() => setModalOpen(false)}>{tOr('billing.refund.back', 'Back')}</button>
            <button type="button" disabled={busy || !canConfirmRefund(operation, checks)} className={BUTTON} onClick={() => void run(async () => { const result = await confirmRefundRequest(operation, checks); setModalOpen(false); return result; })}>{tOr('billing.refund.submit', 'Confirm refund and end subscription')}</button>
          </div>
        </> : null}
      </dialog>
    </section>
  );
}
