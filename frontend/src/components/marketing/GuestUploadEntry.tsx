"use client";

import React, { useCallback, useId, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { useLocale } from '../../i18n';
import { trackEvent } from '../../lib/analytics';
import { openAuthModal } from '../../lib/auth-modal';
import { GUEST_UPLOAD_MAX_MB, savePendingUpload } from '../../lib/pendingUpload';
import { UPLOAD_ACCEPT, isSupportedUploadFile } from '../../lib/uploadFormats';

/**
 * "Use your own document" for signed-out visitors on the editorial surface
 * (plan .collab/plans/2026-11-22-guest-trial-flow-pangram.md, P0).
 *
 * Upload still needs an account. What this removes is the second trip: the
 * picked file waits in this browser (lib/pendingUpload.ts), the sign-in
 * dialog names it, and the dashboard uploads it when the visitor returns
 * signed in (`/?resumeUpload=1`). Nothing is sent before sign-in.
 *
 * Never a filled `.ed-cta`: each marketing view keeps its one filled action
 * (`link` is an `.ed-link`, `dropzone` uses `.ed-cta-quiet`). Kit rule: no
 * `.dt-editorial` root here; the page's MarketingShell / landing root owns it.
 */

export const RESUME_UPLOAD_CALLBACK = '/?resumeUpload=1';

type Props = {
  variant: 'link' | 'dropzone';
  /** Analytics slug for where the entry sits, e.g. `hero` or `demo_dropzone`. */
  location: string;
};

type Problem = 'unsupported' | 'too_large' | 'not_kept' | null;

export default function GuestUploadEntry({ variant, location }: Props) {
  const { tOr } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const messageId = useId();

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file || busy) return;
    if (!isSupportedUploadFile(file)) {
      setProblem('unsupported');
      return;
    }
    if (file.size > GUEST_UPLOAD_MAX_MB * 1024 * 1024) {
      setProblem('too_large');
      return;
    }
    setBusy(true);
    setProblem(null);
    const kept = await savePendingUpload(file);
    setBusy(false);
    trackEvent('landing_cta_clicked', { source: location, reason: kept ? 'own_document' : 'own_document_not_kept' });
    if (kept) {
      openAuthModal({ callbackUrl: RESUME_UPLOAD_CALLBACK, location, pendingFileName: file.name });
    } else {
      // The browser would not keep the file (private window, storage full):
      // sign-in still works, the visitor just picks the file again after.
      setProblem('not_kept');
      openAuthModal({ callbackUrl: '/', location });
    }
  }, [busy, location]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires `change`.
    e.target.value = '';
    void handleFile(file);
  };

  const message = problem === 'unsupported'
    ? tOr('guestUpload.unsupported', 'That format is not supported. Use PDF, DOCX, PPTX, XLSX, TXT or Markdown.')
    : problem === 'too_large'
      ? tOr('guestUpload.tooLarge', 'Files up to {max} MB on the free plan.', { max: GUEST_UPLOAD_MAX_MB })
      : problem === 'not_kept'
        ? tOr('guestUpload.notKept', 'Your browser could not keep the file. Choose it again after you sign in.')
        : null;

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={UPLOAD_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={onInputChange}
    />
  );

  if (variant === 'link') {
    return (
      <span className="inline-flex flex-col items-center gap-2">
        <button
          type="button"
          className="ed-link"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-describedby={message ? messageId : undefined}
        >
          {tOr('guestUpload.cta', 'Try your own document')}
        </button>
        {input}
        {message && (
          <span id={messageId} role="alert" className="ed-caption">
            {message}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className="ed-card ed-guest-drop"
      data-dragging={dragging ? 'true' : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="ed-guest-drop-icon" aria-hidden="true">
            <FileUp size={22} />
          </span>
          <div>
            <h3 className="ed-h3">{tOr('guestUpload.title', 'Or try your own document')}</h3>
            <p className="ed-body" style={{ marginTop: '6px' }}>
              {tOr(
                'guestUpload.body',
                'Drop a PDF, DOCX, PPTX, XLSX, TXT or Markdown file. Sign in for free and it uploads right away. Nothing leaves your browser before you sign in.',
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <button
            type="button"
            className="ed-cta-quiet"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-describedby={message ? messageId : undefined}
          >
            {tOr('guestUpload.choose', 'Choose a file')}
          </button>
          <span className="ed-caption">{tOr('guestUpload.dropHint', 'or drag it here')}</span>
        </div>
      </div>
      {input}
      {message && (
        <p id={messageId} role="alert" className="ed-caption" style={{ marginTop: '14px', color: 'var(--ed-signal-deep)' }}>
          {message}
        </p>
      )}
    </div>
  );
}
