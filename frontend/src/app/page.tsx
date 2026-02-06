"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { getDocument, uploadDocument, deleteDocument, getMyDocuments } from '../lib/api';
import type { DocumentBrief } from '../lib/api';
import { Trash2 } from 'lucide-react';
import { useDocTalkStore } from '../store';
import { useLocale } from '../i18n';
import { PrivacyBadge } from '../components/PrivacyBadge';

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
    if (file.type !== 'application/pdf') {
      setProgressText(t('upload.pdfOnly'));
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
      // Update local state immediately so the document list shows the new doc
      setMyDocs([entry, ...docs.filter(d => d.document_id !== docId)].sort((a, b) => b.createdAt - a.createdAt));
      // Also refresh server-side document list
      getMyDocuments().then(setServerDocs).catch(console.error);

      setProgressText(t('upload.parsing'));
      const timer = setInterval(async () => {
        try {
          const info = await getDocument(docId);
          setDocumentStatus(info.status);
          const pp = info.pages_parsed ?? 0;
          const ci = info.chunks_indexed ?? 0;
          setProgressText(pp === 0 && ci === 0
            ? t('upload.parsing')
            : t('upload.parsingProgress', { pagesParsed: pp, chunksIndexed: ci }));
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-10 dark:bg-gray-900">
      {!isLoggedIn ? (
        <div className="max-w-2xl w-full flex flex-col items-center">
          <h1 className="text-3xl font-semibold text-center dark:text-gray-100">{t('app.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-center">{t('app.subtitle')}</p>

          <div className="mt-4 w-full flex justify-center">
            <PrivacyBadge />
          </div>

          <div className="mt-2 w-full max-w-sm flex flex-col items-stretch gap-3">
            <Link
              href="/demo"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center transition-colors"
            >
              {t('home.cta.demoNow')}
            </Link>

            <button
              type="button"
              onClick={() => router.push('?auth=1', { scroll: false })}
              className="text-blue-600 hover:underline"
            >
              {t('home.cta.loginUpload')}
            </button>

            <button
              onClick={() => signIn('google')}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 
                         border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 
                         hover:bg-gray-50 dark:hover:bg-gray-600 transition font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-gray-700 dark:text-gray-200">{t('auth.continueWithGoogle')}</span>
            </button>

            <p className="text-xs text-green-600 dark:text-green-400 font-medium text-center">
              🎁 {t('auth.freeCredits')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-2xl w-full">
            <h1 className="text-3xl font-semibold text-center dark:text-gray-100">{t('app.title')}</h1>

            <div className="mt-4 w-full flex justify-center">
              <PrivacyBadge />
            </div>

            <div
              className={`mt-2 border-2 border-dashed rounded-xl p-10 text-center ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onInputChange} />
              <p className="text-gray-700 dark:text-gray-300">{t('upload.dragDrop')}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t('upload.or')}</p>
              <button
                type="button"
                onClick={() => (isLoggedIn ? inputRef.current?.click() : router.push('?auth=1', { scroll: false }))}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                disabled={uploading}
              >
                {t('upload.chooseFile')}
              </button>
              {progressText && (
                <div className={`mt-4 text-sm ${uploading ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>{progressText}</div>
              )}
            </div>

            <div className="mt-3 text-center">
              <Link href="/demo" className="text-blue-600 hover:underline text-sm">{t('home.cta.tryDemo')}</Link>
            </div>
          </div>

          <div className="max-w-2xl w-full">
            <h2 className="text-lg font-medium mb-3 dark:text-gray-100">{t('doc.myDocuments')}</h2>
            {allDocs.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t('doc.noDocuments')}</p>) : (
              <ul className="divide-y dark:divide-gray-700 rounded-md border dark:border-gray-700">
                {allDocs.map((d) => (
                  <li key={d.document_id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium dark:text-gray-200">{d.filename || d.document_id}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(d.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded dark:bg-gray-100 dark:text-gray-900"
                        onClick={() => router.push(`/d/${d.document_id}`)}
                      >
                        {t('doc.open')}
                      </button>
                      <button
                        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                        onClick={async () => {
                          if (!window.confirm(t('doc.deleteDocConfirm'))) return;
                          try {
                            await deleteDocument(d.document_id);
                          } catch (e) {
                            // ignore network errors here; local list will still be updated
                          }
                          const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
                          const next = docs.filter((x) => x.document_id !== d.document_id);
                          localStorage.setItem('doctalk_docs', JSON.stringify(next));
                          setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
                          setServerDocs((prev) => prev.filter((s) => s.id !== d.document_id));
                        }}
                        title={t('doc.deleteDoc')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
