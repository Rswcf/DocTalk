"use client";

import React, { useEffect, useState, useRef } from 'react';
import { PROXY_BASE } from '../../lib/api';
import { useLocale } from '../../i18n';

interface TextPage {
  page_number: number;
  text: string;
}

interface Props {
  documentId: string;
  targetPage?: number;
  scrollNonce?: number;
}

export default function TextViewer({ documentId, targetPage, scrollNonce }: Props) {
  const [pages, setPages] = useState<TextPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { t } = useLocale();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${PROXY_BASE}/api/documents/${documentId}/text-content`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setPages(data.pages || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [documentId]);

  // Scroll to target page when citation is clicked
  useEffect(() => {
    if (targetPage && scrollNonce) {
      const el = pageRefs.current.get(targetPage);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [targetPage, scrollNonce]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto p-6">
      {pages.map((page) => (
        <div
          key={page.page_number}
          ref={(el) => { if (el) pageRefs.current.set(page.page_number, el); }}
          className="mb-6"
        >
          <div className="text-xs text-zinc-400 mb-2 sticky top-0 bg-white dark:bg-zinc-950 py-1">
            {t('doc.page')} {page.page_number}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200 font-sans leading-relaxed">
            {page.text}
          </pre>
        </div>
      ))}
    </div>
  );
}
