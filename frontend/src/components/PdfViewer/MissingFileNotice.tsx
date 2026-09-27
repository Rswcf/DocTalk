"use client";

import { AlertTriangle } from 'lucide-react';
import { useLocale } from '../../i18n';
import type { MissingFileVariant } from '../../lib/useDocumentLoader';

interface Props {
  variant: MissingFileVariant;
}

/**
 * Shown above the extracted-text view when a document's stored file was lost
 * (410 FILE_MISSING from /file-url). Chat, citations and Quote Finder read
 * only the database, so they keep working; only the page view is gone.
 */
export default function MissingFileNotice({ variant }: Props) {
  const { tOr } = useLocale();
  const title = variant === 'original'
    ? tOr('doc.fileMissing.title', 'The original PDF is no longer available')
    : tOr('doc.fileMissing.convertedTitle', 'The page view of this file is no longer available');
  const body = variant === 'original'
    ? tOr(
      'doc.fileMissing.body',
      'This file was lost in a storage failure in June 2026 and cannot be recovered. Everything DocTalk extracted from it at upload time is still here: you can keep chatting, follow citations and use Quote Finder. Page view, translation and re-processing need the file itself. Upload it again as a new document to get them back.',
    )
    : tOr(
      'doc.fileMissing.convertedBody',
      'The page view of this file was lost in a storage failure in June 2026 and cannot be recovered. Its extracted text is shown instead, and chat, citations and Quote Finder work as before. Upload the file again as a new document to get the page view back.',
    );

  return (
    <div
      className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
      role="status"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 leading-relaxed text-amber-900 dark:text-amber-200">{body}</p>
      </div>
    </div>
  );
}
