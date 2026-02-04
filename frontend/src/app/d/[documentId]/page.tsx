"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PdfViewer } from '../../../components/PdfViewer';
import { ChatPanel } from '../../../components/Chat';
import { createSession, getDocument, getDocumentFileUrl } from '../../../lib/api';
import { useDocTalkStore } from '../../../store';

export default function DocumentReaderPage() {
  const params = useParams<{ documentId: string }>();
  const documentId = params?.documentId as string;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    pdfUrl,
    currentPage,
    highlights,
    scale,
    setPdfUrl,
    setDocument,
    setDocumentStatus,
    setSessionId,
    sessionId,
    navigateToCitation,
  } = useDocTalkStore();

  useEffect(() => {
    if (!documentId) return;
    setDocument(documentId);
    (async () => {
      try {
        const info = await getDocument(documentId);
        setDocumentStatus(info.status);
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.includes('HTTP 404')) {
          setError('文档不存在');
          return;
        }
        setError('加载文档信息失败');
      }
      try {
        const file = await getDocumentFileUrl(documentId);
        setPdfUrl(file.url);
      } catch (e) {
        // 保持 PdfViewer 自身的错误提示
      }
      try {
        const s = await createSession(documentId);
        setSessionId(s.session_id);
      } catch (e) {
        // 聊天会话创建失败将由 ChatPanel 的错误处理体现
      }
    })();
  }, [documentId, setDocument, setDocumentStatus, setPdfUrl, setSessionId]);

  return (
    <div className="flex h-screen w-full">
      {error ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium mb-3">{error}</div>
            <button
              className="px-4 py-2 bg-gray-900 text-white rounded"
              onClick={() => router.push('/')}
            >
              返回首页
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            {pdfUrl ? (
              <PdfViewer pdfUrl={pdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-500">Loading document…</div>
            )}
          </div>
          <div className="w-[400px] min-w-[320px] max-w-[480px]">
            {sessionId ? (
              <ChatPanel sessionId={sessionId} onCitationClick={navigateToCitation} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-500">Initializing chat…</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
