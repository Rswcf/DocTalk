export interface ModelOption {
  id: string;
  label: string;
  provider: string;
}

export const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4.5";

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5", provider: "Anthropic" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI" },
  { id: "openai/gpt-5.2-pro", label: "GPT-5.2 Pro", provider: "OpenAI" },
  { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "Google" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", provider: "DeepSeek" },
  { id: "mistralai/mistral-large-2512", label: "Mistral Large", provider: "Mistral" },
  { id: "qwen/qwen3-coder-next", label: "Qwen3 Coder", provider: "Qwen" }
];

