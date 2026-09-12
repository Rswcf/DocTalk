'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '../../i18n';
import { createAnswerShare, getAnswerSharePreview, revokeAnswerShares, type AnswerSharePreview } from '../../lib/api';
import { errorCopy } from '../../lib/errorCopy';
import { trackEvent } from '../../lib/analytics';

export default function ShareAnswerDialog({ sessionId, messageId, onClose }: {
  sessionId: string;
  messageId: string;
  onClose: () => void;
}) {
  const { t, tOr } = useLocale();
  const titleId = useId();
  const noticeId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const [preview, setPreview] = useState<AnswerSharePreview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<ReturnType<typeof errorCopy> | null>(null);
  const [status, setStatus] = useState('');
  const [url, setUrl] = useState('');

  const load = useCallback(async () => {
    const current = ++generation.current;
    setBusy(true);
    setError(null);
    setPreview(null);
    setStatus('');
    setUrl('');
    try {
      const result = await getAnswerSharePreview(sessionId, messageId);
      if (generation.current === current) setPreview(result);
    } catch (e) {
      if (generation.current === current) setError(errorCopy(e, t, tOr));
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }, [sessionId, messageId, t, tOr]);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const lifecycle = generation;
    element?.showModal();
    return () => {
      ++lifecycle.current;
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => { void load(); }, [load]);

  const close = () => {
    ++generation.current;
    onClose();
  };

  const act = async (revoke: boolean) => {
    if (!preview || busy || pending.current) return;
    pending.current = true;
    const current = generation.current;
    setBusy(true);
    setError(null);
    setStatus('');
    setUrl('');
    try {
      if (revoke) {
        await revokeAnswerShares(sessionId, messageId);
        if (generation.current !== current) return;
        setPreview({ ...preview, active_count: 0 });
        setStatus(t('share.answerRevoked'));
      } else {
        const result = await createAnswerShare(sessionId, messageId, preview.snapshot_digest);
        if (generation.current !== current) return;
        setUrl(result.url);
        setPreview({ ...preview, active_count: Math.max(1, preview.active_count) });
        trackEvent('share_created', { source: 'answer_action' });
        try {
          await navigator.clipboard.writeText(result.url);
          if (generation.current === current) setStatus(t('share.answerCopied'));
        } catch {
          if (generation.current === current) setStatus(t('share.copyManually'));
        }
      }
    } catch (e) {
      if (generation.current === current) setError(errorCopy(e, t, tOr));
    } finally {
      pending.current = false;
      if (generation.current === current) setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={noticeId}
      onCancel={(event) => { event.preventDefault(); close(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold">{t('chat.shareAnswer')}</h2>
        <button type="button" autoFocus onClick={close} aria-label={t('common.close')}
          className="rounded-md p-2 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800"><X size={20} /></button>
      </div>
      <p id={noticeId} className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{t('share.answerNotice')}</p>
      {preview && (
        <section aria-label={t('share.answerPreview')} className="my-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <h3 className="mb-2 text-sm font-medium">{t('share.answerPreview')}</h3>
          <p dir="auto" className="mb-3 break-words text-xs text-zinc-500">{preview.preview.document_name}</p>
          {preview.preview.messages.map((message) => (
            <div key={message.id}>
              <p dir="auto" className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
              {message.citations.map((citation) => (
                <blockquote key={citation.ref_index} dir="auto" className="mt-3 break-words border-s-2 border-zinc-300 ps-3 text-xs text-zinc-600 dark:text-zinc-300">
                  <p>[{citation.ref_index}] {citation.document_filename}{citation.page != null ? ` · p. ${citation.page}${citation.page_end && citation.page_end !== citation.page ? `–${citation.page_end}` : ''}` : ''}</p>
                  <p className="mt-1 whitespace-pre-wrap">{citation.text_snippet}</p>
                </blockquote>
              ))}
            </div>
          ))}
        </section>
      )}
      {error && <div role="alert" className="my-3 text-sm text-red-700 dark:text-red-300">
        <p>{error.body}</p>
        {error.cta && <a href={error.cta.href} className="underline">{error.cta.label}</a>}
        <button type="button" onClick={() => void load()} disabled={busy} className="ms-3 underline disabled:opacity-50">{t('common.retry')}</button>
      </div>}
      <p role="status" className="my-3 text-sm">{busy ? t('common.loading') : status}</p>
      {url && <label className="mb-4 block text-sm">{t('share.answerLink')}
        <input readOnly value={url} dir="ltr" onFocus={(event) => event.target.select()} className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent p-2 text-xs dark:border-zinc-600" />
      </label>}
      <div className="flex flex-wrap justify-end gap-3">
        {!!preview?.active_count && <button type="button" onClick={() => void act(true)} disabled={busy}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-600">{t('share.revokeAnswer')}</button>}
        <button type="button" onClick={() => void act(false)} disabled={!preview || busy || !!error}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">{t('share.copyAnswerLink')}</button>
      </div>
    </dialog>
  );
}
