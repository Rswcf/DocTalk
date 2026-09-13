"use client";

import { useLocale } from '../i18n';

export function WorkflowCostEstimate({ amount, balance, failed, retry, quoteSearch = false }: {
  amount?: number; balance?: number; failed: boolean; retry: () => void; quoteSearch?: boolean;
}) {
  const { t } = useLocale();
  return <div className="my-3 space-y-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400" role="status">
    {amount === undefined || balance === undefined ? <>
      <p>{failed ? t('workflowCost.unavailable') : t('common.loading')}</p>
      {failed && <button type="button" className="min-h-10 underline" onClick={retry}>{t('common.retry')}</button>}
    </> : <>
      <p>{t('workflowCost.reserve', { amount, balance })}</p>
      <details>
        <summary className="cursor-pointer underline">{t('workflowCost.rules')}</summary>
        <p>{t('workflowCost.estimate', { amount, balance })}</p>
        <p>{t('workflowCost.failureRule')}</p>
        {quoteSearch && <p>{t('workflowCost.quoteEmpty')}</p>}
      </details>
    </>}
  </div>;
}

export function WorkflowCostSummary({ status, cost, preDebited }: {
  status: string; cost?: number; preDebited?: number | null;
}) {
  const { t } = useLocale();
  const terminal = ['succeeded', 'failed', 'cancelled'].includes(status);
  return <div className="my-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400" role="status">
    {!terminal ? (preDebited != null && <p>{t('workflowCost.working', { amount: preDebited })}</p>) : cost !== undefined && <>
      {preDebited != null && <p>{t('workflowCost.reserved', { amount: preDebited })}</p>}
      <p>{t('workflowCost.actual', { amount: cost })}</p>
      {preDebited != null && <p>{t(cost > preDebited ? 'workflowCost.additional' : 'workflowCost.returned', { amount: Math.abs(preDebited - cost) })}</p>}
    </>}
  </div>;
}
