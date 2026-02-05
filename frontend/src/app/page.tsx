"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDocument, uploadDocument } from '../lib/api';
import { useDocTalkStore } from '../store';

type StoredDoc = { document_id: string; filename?: string; createdAt: number };

export default function HomePage() {
  const router = useRouter();
  const { setDocument, setDocumentStatus } = useDocTalkStore();
  const [isDragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [myDocs, setMyDocs] = useState<StoredDoc[]>([]);

  useEffect(() => {
    const docs = JSON.parse(localStorage.getItem('doctalk_docs') || '[]') as StoredDoc[];
    setMyDocs(docs.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  const onFiles = useCallback(async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setProgressText('请上传 PDF 文件');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setProgressText('文件大小不能超过 50MB');
      return;
    }
    setUploading(true);
    setProgressText('Uploading…');
    setDocumentStatus('uploading');
    try {
      const res = await uploadDocument(file);
      const docId = res.document_id;
      setDocument(docId);
      const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
      const entry: StoredDoc = { document_id: docId, filename: res.filename, createdAt: Date.now() };
      localStorage.setItem('doctalk_docs', JSON.stringify([entry, ...docs.filter(d => d.document_id !== docId)]));

      setProgressText('Parsing…');
      const timer = setInterval(async () => {
        try {
          const info = await getDocument(docId);
          setDocumentStatus(info.status);
          setProgressText(`Parsing pages: ${info.pages_parsed ?? 0}, indexing: ${info.chunks_indexed ?? 0}`);
          if (info.status === 'ready') {
            clearInterval(timer);
            router.push(`/d/${docId}`);
          }
          if (info.status === 'error') {
            clearInterval(timer);
            setProgressText('Error during processing');
            setUploading(false);
          }
        } catch (e) {
          clearInterval(timer);
          setProgressText('Error');
          setUploading(false);
        }
      }, 2000);
    } catch (e: any) {
      setProgressText('上传失败，请检查网络或稍后重试');
      setUploading(false);
    }
  }, [router, setDocument, setDocumentStatus]);

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
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-semibold text-center dark:text-gray-100">DocTalk</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-center">Upload a PDF to start chatting.</p>

        <div
          className={`mt-6 border-2 border-dashed rounded-xl p-10 text-center ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onInputChange} />
          <p className="text-gray-700 dark:text-gray-300">Drag & drop your PDF here</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">or</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            disabled={uploading}
          >
            Choose File
          </button>
          {progressText && (
            <div className={`mt-4 text-sm ${uploading ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>{progressText}</div>
          )}
        </div>
      </div>

      <div className="max-w-2xl w-full">
        <h2 className="text-lg font-medium mb-3 dark:text-gray-100">我的文档</h2>
        {myDocs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">暂无历史文档</p>) : (
          <ul className="divide-y dark:divide-gray-700 rounded-md border dark:border-gray-700">
            {myDocs.map((d) => (
              <li key={d.document_id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium dark:text-gray-200">{d.filename || d.document_id}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(d.createdAt).toLocaleString()}</div>
                </div>
                <button
                  className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded dark:bg-gray-100 dark:text-gray-900"
                  onClick={() => router.push(`/d/${d.document_id}`)}
                >
                  打开
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
