export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  tier: 'budget' | 'standard' | 'premium';
}

export const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4.5";

export const AVAILABLE_MODELS: ModelOption[] = [
  // Budget tier
  { id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", provider: "xAI", tier: "budget" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", provider: "DeepSeek", tier: "budget" },
  { id: "minimax/minimax-m2.1", label: "MiniMax M2.1", provider: "MiniMax", tier: "budget" },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5", provider: "Moonshot", tier: "budget" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "Google", tier: "budget" },
  // Standard tier
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI", tier: "standard" },
  { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "Google", tier: "standard" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "Anthropic", tier: "standard" },
  // Premium tier
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", provider: "Anthropic", tier: "premium" },
];

