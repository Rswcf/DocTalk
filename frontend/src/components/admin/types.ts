export interface Overview {
  total_users: number;
  paid_users: number;
  plus_users: number;
  pro_users: number;
  total_documents: number;
  total_sessions: number;
  total_messages: number;
  total_tokens: number;
  total_credits_spent: number;
  total_credits_granted: number;
}

export interface TrendPoint {
  date: string;
  count?: number;
  total_tokens?: number;
  amount?: number;
}

export interface Trends {
  signups: TrendPoint[];
  documents: TrendPoint[];
  tokens: TrendPoint[];
  credits_spent: TrendPoint[];
  active_users: TrendPoint[];
}

export interface Breakdowns {
  plan_distribution: { plan: string; count: number }[];
  model_usage: { model: string; calls: number; tokens: number; credits: number }[];
  file_types: { file_type: string; count: number }[];
  doc_status: { status: string; count: number }[];
}
