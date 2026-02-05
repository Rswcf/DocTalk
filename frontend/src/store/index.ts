"use client";

import { create } from 'zustand';
import type { Citation, Message, NormalizedBBox } from '../types';

type DocStatus = 'idle' | 'uploading' | 'parsing' | 'embedding' | 'ready' | 'error';

export interface DocTalkStore {
  // Document
  documentId: string | null;
  documentName: string | null;
  documentStatus: DocStatus;
  totalPages: number;
  parseProgress: { pagesParsed: number; chunksIndexed: number };

  // PDF
  currentPage: number;
  scale: number;
  highlights: NormalizedBBox[];
  pdfUrl: string | null;
  scrollNonce: number;

  // Chat
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  selectedModel: string;

  // Actions
  setDocument: (id: string) => void;
  setDocumentName: (name: string) => void;
  setDocumentStatus: (status: DocStatus) => void;
  setPdfUrl: (url: string) => void;
  setPage: (page: number) => void;
  setScale: (scale: number) => void;
  setHighlights: (highlights: NormalizedBBox[]) => void;
  navigateToCitation: (citation: Citation) => void;
  addMessage: (msg: Message) => void;
  updateLastMessage: (text: string) => void;
  addCitationToLastMessage: (citation: Citation) => void;
  setStreaming: (v: boolean) => void;
  setSessionId: (id: string) => void;
  setSelectedModel: (id: string) => void;
  reset: () => void;
}

const initialState = {
  documentId: null as string | null,
  documentName: null as string | null,
  documentStatus: 'idle' as DocStatus,
  totalPages: 0,
  parseProgress: { pagesParsed: 0, chunksIndexed: 0 },
  currentPage: 1,
  scale: 1,
  highlights: [] as NormalizedBBox[],
  pdfUrl: null as string | null,
  sessionId: null as string | null,
  messages: [] as Message[],
  isStreaming: false,
  scrollNonce: 0,
  selectedModel: (typeof window !== 'undefined' ? localStorage.getItem('doctalk_model') : null) || "anthropic/claude-sonnet-4.5",
};

export const useDocTalkStore = create<DocTalkStore>((set, get) => ({
  ...initialState,

  setDocument: (id: string) => set({ documentId: id }),
  setDocumentName: (name: string) => set({ documentName: name }),
  setDocumentStatus: (status: DocStatus) => set({ documentStatus: status }),
  setPdfUrl: (url: string) => set({ pdfUrl: url }),
  setPage: (page: number) => set({ currentPage: Math.max(1, page) }),
  setScale: (scale: number) => set({ scale: Math.max(0.25, scale) }),
  setHighlights: (highlights: NormalizedBBox[]) => set({ highlights }),
  navigateToCitation: (citation: Citation) => {
    const bboxes = (citation.bboxes || []).map((bb: any) => ({
      ...bb,
      page: bb.page ?? citation.page,
    }));
    set((state) => ({
      currentPage: citation.page,
      highlights: bboxes,
      scrollNonce: state.scrollNonce + 1,
    }));
  },
  addMessage: (msg: Message) => set({ messages: [...get().messages, msg] }),
  updateLastMessage: (text: string) => {
    const msgs = get().messages;
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    const updated = { ...last, text: (last.text || '') + text };
    set({ messages: [...msgs.slice(0, -1), updated] });
  },
  addCitationToLastMessage: (citation: Citation) => {
    const msgs = get().messages;
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    const citations = [...(last.citations || []), citation];
    const updated = { ...last, citations } as Message;
    set({ messages: [...msgs.slice(0, -1), updated] });
  },
  setStreaming: (v: boolean) => set({ isStreaming: v }),
  setSessionId: (id: string) => set({ sessionId: id }),
  setSelectedModel: (id: string) => {
    set({ selectedModel: id });
    try { localStorage.setItem('doctalk_model', id); } catch {}
  },
  reset: () => set((state) => ({ ...initialState, selectedModel: state.selectedModel })),
}));
