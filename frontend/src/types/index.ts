export type Role = 'user' | 'assistant';

export interface NormalizedBBox {
  // Normalized coordinates in [0, 1] relative to the page viewport
  x: number;
  y: number;
  w: number;
  h: number;
  page?: number;
}

export interface Citation {
  refIndex: number; // [n] index starting from 1
  chunkId: string;
  page: number; // 1-based page number
  bboxes: NormalizedBBox[];
  textSnippet: string;
  offset: number; // character offset in assistant message text
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  citations?: Citation[];
  createdAt?: number;
  isError?: boolean;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  status: 'idle' | 'uploading' | 'parsing' | 'embedding' | 'ready' | 'error';
  page_count?: number;
  pages_parsed: number;
  chunks_total: number;
  chunks_indexed: number;
  created_at: string;
}

export interface SearchResult {
  chunk_id: string;
  page: number;
  text_snippet: string;
  score: number;
  bboxes?: NormalizedBBox[];
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface SessionItem {
  session_id: string;
  title: string | null;
  message_count: number;
  created_at: string;
  last_activity_at: string;
}

export interface SessionListResponse {
  sessions: SessionItem[];
}
