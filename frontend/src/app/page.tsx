"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ShowcasePlayer from '../components/landing/ShowcasePlayer';
import { useSession, signIn } from 'next-auth/react';
import { getDocument, uploadDocument, deleteDocument, getMyDocuments, ingestUrl } from '../lib/api';
import type { DocumentBrief } from '../lib/api';
import { Trash2, Link2 } from 'lucide-react';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { sanitizeFilename } from '../lib/utils';
import { PrivacyBadge } from '../components/PrivacyBadge';
import Header from '../components/Header';
import HeroSection from '../components/landing/HeroSection';
import FeatureGrid from '../components/landing/FeatureGrid';
import HowItWorks from '../components/landing/HowItWorks';
import SocialProof from '../components/landing/SocialProof';
import SecuritySection from '../components/landing/SecuritySection';
import FAQ from '../components/landing/FAQ';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/Footer';
import ScrollReveal from '../components/landing/ScrollReveal';

type StoredDoc = { document_id: string; filename?: string; createdAt: number };

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const { setDocument, setDocumentStatus } = useDocTalkStore();
  const { t } = useLocale();
  const [isDragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [myDocs, setMyDocs] = useState<StoredDoc[]>([]);
  const [serverDocs, setServerDocs] = useState<DocumentBrief[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    const docs = JSON.parse(localStorage.getItem('doctalk_docs') || '[]') as StoredDoc[];
    setMyDocs(docs.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      getMyDocuments().then(setServerDocs).catch(console.error);
    }
  }, [isLoggedIn]);

  const allDocs = useMemo(() => {
    const serverIds = new Set(serverDocs.map((d) => d.id));
    const localOnly = myDocs.filter((d) => !serverIds.has(d.document_id));
    const mappedServer: StoredDoc[] = serverDocs.map((d) => ({
      document_id: d.id,
      filename: d.filename,
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
    }));
    return [...mappedServer, ...localOnly].sort((a, b) => b.createdAt - a.createdAt);
  }, [serverDocs, myDocs]);

  const onFiles = useCallback(async (file: File) => {
    if (!file) return;
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
    ];
    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      setProgressText(t('upload.unsupportedFormat'));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setProgressText(t('upload.tooLarge'));
      return;
    }
    setUploading(true);
    setProgressText(t('upload.uploading'));
    setDocumentStatus('uploading');
    try {
      const res = await uploadDocument(file);
      const docId = res.document_id;
      setDocument(docId);
      const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
      const entry: StoredDoc = { document_id: docId, filename: res.filename, createdAt: Date.now() };
      localStorage.setItem('doctalk_docs', JSON.stringify([entry, ...docs.filter(d => d.document_id !== docId)]));
      setMyDocs([entry, ...docs.filter(d => d.document_id !== docId)].sort((a, b) => b.createdAt - a.createdAt));
      getMyDocuments().then(setServerDocs).catch(console.error);

      setProgressText(t('upload.parsing'));
      const timer = setInterval(async () => {
        try {
          const info = await getDocument(docId);
          setDocumentStatus(info.status);
          const pp = info.pages_parsed ?? 0;
          const ci = info.chunks_indexed ?? 0;
          if (info.status === 'ocr') {
            setProgressText(t('upload.ocr'));
          } else if (pp === 0 && ci === 0) {
            setProgressText(t('upload.parsing'));
          } else {
            setProgressText(t('upload.parsingProgress', { pagesParsed: pp, chunksIndexed: ci }));
          }
          if (info.status === 'ready') {
            clearInterval(timer);
            router.push(`/d/${docId}`);
          }
          if (info.status === 'error') {
            clearInterval(timer);
            setProgressText(t('upload.error'));
            setUploading(false);
          }
        } catch (e) {
          clearInterval(timer);
          setProgressText(t('upload.error'));
          setUploading(false);
        }
      }, 2000);
    } catch (e: any) {
      setProgressText(t('upload.networkError'));
      setUploading(false);
    }
  }, [router, setDocument, setDocumentStatus, t]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFiles(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFiles(file);
  };

  const onUrlSubmit = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setUrlError(t('upload.urlError'));
      return;
    }
    setUrlLoading(true);
    setUrlError('');
    try {
      const res = await ingestUrl(url);
      const docId = res.document_id;
      setDocument(docId);
      setUrlInput('');
      getMyDocuments().then(setServerDocs).catch(console.error);
      router.push(`/d/${docId}`);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('URL_CONTENT_TOO_LARGE')) {
        setUrlError(t('upload.urlTooLarge'));
      } else if (msg.includes('NO_TEXT_CONTENT')) {
        setUrlError(t('upload.noTextContent'));
      } else {
        setUrlError(t('upload.urlError'));
      }
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, router, setDocument, t]);

  /* --- Loading guard (prevents flash of wrong content) --- */
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">{t('common.loading') || 'Loading...'}</div>
      </div>
    );
  }

  /* --- Logged-out landing page --- */
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
        <Header variant="minimal" />

        <HeroSection />

        {/* Product Showcase */}
        <ScrollReveal direction="up" delay={100}>
          <section className="w-full px-4 sm:px-8 lg:px-16 py-24">
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-12 max-w-6xl mx-auto">
              <h2 className="font-display text-3xl tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-8">
                {t('landing.showcase.title')}
              </h2>
            </div>
            <div className="relative max-w-6xl mx-auto">
              {/* Accent glow behind showcase */}
              <div
                aria-hidden="true"
                className="glow-accent absolute -inset-8 blur-2xl opacity-60 pointer-events-none"
              />
              <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
                {/* macOS window chrome */}
                <div className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  {/* Traffic lights */}
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="w-3 h-3 rounded-full bg-red-400" />
                    <span aria-hidden="true" className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span aria-hidden="true" className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  {/* Fake URL bar */}
                  <div className="flex-1 flex justify-center">
                    <div className="bg-zinc-200 dark:bg-zinc-700 rounded-md px-4 py-1">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 select-none">doctalk.site</span>
                    </div>
                  </div>
                  {/* Spacer to balance traffic lights */}
                  <div className="w-[52px]" aria-hidden="true" />
                </div>
                <div className="aspect-video bg-zinc-50 dark:bg-zinc-900 relative">
                  <ShowcasePlayer />
                </div>
              </div>
            </div>
            {/* Caption */}
            <p className="mt-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
              {t('landing.showcase.caption')}
            </p>
          </section>
        </ScrollReveal>

        <HowItWorks />

        <FeatureGrid />

        <SocialProof />

        <SecuritySection />

        <FAQ />

        <FinalCTA />

        {/* Privacy Badge */}
        <section className="py-8 flex justify-center">
          <PrivacyBadge />
        </section>

        <Footer />
      </div>
    );
  }

  /* --- Logged-in dashboard --- */
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      <Header variant="full" />
      <main className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-10">
        <div className="max-w-4xl w-full">
          <div className="mb-4 flex justify-center">
            <PrivacyBadge />
          </div>

          <div
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-colors ${
              isDragging
                ? 'border-zinc-500 bg-zinc-50 dark:bg-zinc-900'
                : 'border-zinc-300 dark:border-zinc-700'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,.pdf,.docx,.pptx,.xlsx,.txt,.md" className="hidden" onChange={onInputChange} aria-label="Upload document" />
            <p className="text-zinc-700 dark:text-zinc-300 text-lg">{t('upload.dragDrop')}</p>
            <p className="text-zinc-400 text-xs mt-1">{t('upload.supportedFormats')}</p>
            <p className="text-zinc-400 text-sm mt-1">{t('upload.or')}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 px-6 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-[box-shadow,color,background-color] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              disabled={uploading}
            >
              {t('upload.chooseFile')}
            </button>
            {progressText && (
              <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
                {progressText}
              </div>
            )}
          </div>

          {/* URL Import */}
          <div className="mt-4 flex items-center gap-2 max-w-lg mx-auto">
            <div className="flex-1 relative">
              <Link2 aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') onUrlSubmit(); }}
                placeholder={t('upload.urlPlaceholder')}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 transition-shadow"
                disabled={urlLoading}
                aria-label="Document URL"
              />
            </div>
            <button
              onClick={onUrlSubmit}
              disabled={urlLoading || !urlInput.trim()}
              className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              {urlLoading ? '...' : t('upload.ingestUrl')}
            </button>
          </div>
          {urlError && (
            <p role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">{urlError}</p>
          )}

          <div className="mt-3 text-center">
            <Link href="/demo" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
              {t('home.cta.tryDemo')}
            </Link>
          </div>
        </div>

        <div className="max-w-4xl w-full">
          <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">{t('doc.myDocuments')}</h2>
          {allDocs.length === 0 ? (
            <p className="text-zinc-500 text-sm">{t('doc.noDocuments')}</p>
          ) : (
            <div className="space-y-3">
              {allDocs.map((d) => (
                <div
                  key={d.document_id}
                  className="p-5 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
                >
                  <Link href={`/d/${d.document_id}`} className="flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {d.filename ? sanitizeFilename(d.filename) : d.document_id}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {new Date(d.createdAt).toLocaleString()}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/d/${d.document_id}`}
                      className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      {t('doc.open')}
                    </Link>
                    <button
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                      disabled={deletingId === d.document_id}
                      onClick={async () => {
                        if (!window.confirm(t('doc.deleteDocConfirm'))) return;
                        setDeletingId(d.document_id);
                        try { await deleteDocument(d.document_id); } catch {}
                        const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
                        const next = docs.filter((x) => x.document_id !== d.document_id);
                        localStorage.setItem('doctalk_docs', JSON.stringify(next));
                        setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
                        setServerDocs((prev) => prev.filter((s) => s.id !== d.document_id));
                        setDeletingId(null);
                      }}
                      title={t('doc.deleteDoc')}
                      aria-label="Delete document"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
