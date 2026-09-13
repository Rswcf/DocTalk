"use client";

import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n';
import { listLayoutTranslations } from '../../lib/api';
import { errorCopy } from '../../lib/errorCopy';
import type { ChatArtifact } from '../../types';
import ChatArtifactCard from '../Chat/ChatArtifactCard';

export default function LayoutTranslationHistory({ documentId, onPreview }: {
  documentId: string;
  onPreview: (url: string, artifact: ChatArtifact) => void;
}) {
  const { t, tOr, locale } = useLocale();
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof listLayoutTranslations>> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLayoutTranslations(documentId, offset).then((result) => {
      if (!cancelled) setData(result);
    }).catch((err) => {
      if (!cancelled) setError(err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [documentId, offset, retry]);

  return <details className="border-b border-[var(--reader-border)] px-5 py-4">
    <summary className="cursor-pointer text-sm font-semibold focus-visible:ring-2 focus-visible:ring-zinc-400">
      {tOr('layoutTranslation.history', 'Previous translations')}{data ? ` (${data.total})` : ''}
    </summary>
    <div aria-busy={loading} className="mt-3">
      {loading ? <p role="status" className="text-sm">{t('common.loading')}</p>
        : error ? <div role="alert" className="text-sm">
          <p>{errorCopy(error, t, tOr).body}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-2 underline">{t('common.retry')}</button>
        </div>
        : !data?.items.length ? <p className="text-sm text-[var(--reader-muted)]">{tOr('layoutTranslation.historyEmpty', 'No previous translations for this PDF.')}</p>
        : <>
          {data.items.map((job) => <section key={job.id}>
            {job.created_at ? <p className="mt-4 text-xs text-[var(--reader-muted)]"><time dateTime={job.created_at}>{new Date(job.created_at).toLocaleString(locale)}</time></p> : null}
            <ChatArtifactCard artifact={job.artifact} onPreviewLayoutTranslation={onPreview} allowAutoImport={false} />
          </section>)}
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - data.limit))} className="min-h-10 underline disabled:opacity-40">{t('profile.credits.prevPage')}</button>
            <span>{offset + 1}–{offset + data.items.length} / {data.total}</span>
            <button type="button" disabled={offset + data.items.length >= data.total} onClick={() => setOffset(offset + data.limit)} className="min-h-10 underline disabled:opacity-40">{t('profile.credits.nextPage')}</button>
          </div>
        </>}
    </div>
  </details>;
}
