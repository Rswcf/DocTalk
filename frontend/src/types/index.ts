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
  status: 'idle' | 'uploading' | 'parsing' | 'ocr' | 'embedding' | 'ready' | 'error';
  page_count?: number;
  pages_parsed: number;
  chunks_total: number;
  chunks_indexed: number;
  created_at: string;
  is_demo?: boolean;
  error_msg?: string;
  summary?: string;
  suggested_questions?: string[];
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

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  created_at: string;
  plan: 'free' | 'plus' | 'pro';
  credits_balance: number;
  monthly_allowance: number;
  monthly_credits_granted_at: string | null;
  signup_bonus_granted: boolean;
  connected_accounts: Array<{ provider: string; created_at: string }>;
  stats: {
    total_documents: number;
    total_sessions: number;
    total_messages: number;
    total_credits_spent: number;
    total_tokens_used: number;
  };
}

export interface CreditHistoryItem {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
}

export interface CreditHistoryResponse {
  items: CreditHistoryItem[];
  total: number;
}

export interface UsageBreakdown {
  by_model: Array<{
    model: string;
    total_calls: number;
    total_tokens: number;
    total_credits: number;
  }>;
}
