export type PlanType = 'free' | 'plus' | 'pro';

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  tier: 'budget' | 'standard' | 'premium';
  minPlan: PlanType;
}

export const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4.5";

export const AVAILABLE_MODELS: ModelOption[] = [
  // Budget tier — available to all plans
  { id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", provider: "xAI", tier: "budget", minPlan: "free" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", provider: "DeepSeek", tier: "budget", minPlan: "free" },
  { id: "minimax/minimax-m2.1", label: "MiniMax M2.1", provider: "MiniMax", tier: "budget", minPlan: "free" },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5", provider: "Moonshot", tier: "budget", minPlan: "free" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "Google", tier: "budget", minPlan: "free" },
  // Standard tier — available to all plans
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI", tier: "standard", minPlan: "free" },
  { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "Google", tier: "standard", minPlan: "free" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "Anthropic", tier: "standard", minPlan: "free" },
  // Premium tier — requires Plus or above
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", provider: "Anthropic", tier: "premium", minPlan: "plus" },
];

const PLAN_HIERARCHY: Record<PlanType, number> = { free: 0, plus: 1, pro: 2 };

export function isModelAvailable(modelId: string, userPlan: string): boolean {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!model) return false;
  const userLevel = PLAN_HIERARCHY[userPlan as PlanType] ?? 0;
  const requiredLevel = PLAN_HIERARCHY[model.minPlan];
  return userLevel >= requiredLevel;
}

