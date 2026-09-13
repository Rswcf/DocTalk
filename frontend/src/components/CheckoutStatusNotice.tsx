"use client";

import { useEffect, useRef } from 'react';
import { useLocale } from '../i18n';
import { useCheckoutStatus } from '../lib/useCheckoutStatus';

export default function CheckoutStatusNotice({ sessionId, enabled, onConfirmed }: {
  sessionId: string | null;
  enabled: boolean;
  onConfirmed: () => void;
}) {
  const { t } = useLocale();
  const { status, retry } = useCheckoutStatus(sessionId, enabled);
  const confirmed = useRef(false);
  useEffect(() => {
    if (status === 'complete' && !confirmed.current) {
      confirmed.current = true;
      onConfirmed();
    }
  }, [status, onConfirmed]);
  return <div className="mb-6 rounded-xl bg-zinc-100 p-4 text-sm dark:bg-zinc-800" role="status">
    <p>{t(`billing.checkout.${status}`)}</p>
    {['unavailable', 'delayed'].includes(status) && <div className="mt-3 flex flex-wrap gap-4">
      {sessionId && <button type="button" className="min-h-10 underline" onClick={retry}>{t('common.retry')}</button>}
      <a className="inline-flex min-h-10 items-center underline" href="mailto:support@doctalk.site">{t('billing.checkout.support')}</a>
    </div>}
  </div>;
}
