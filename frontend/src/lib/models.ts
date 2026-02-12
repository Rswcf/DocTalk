export type ModeId = 'quick' | 'balanced' | 'thorough';
export type PlanType = 'free' | 'plus' | 'pro';

export interface ModeOption {
  id: ModeId;
  labelKey: string;
  descriptionKey: string;
  minPlan: PlanType;
}

export const DEFAULT_MODE: ModeId = 'quick';

export const AVAILABLE_MODES: ModeOption[] = [
  { id: 'quick', labelKey: 'modes.quick', descriptionKey: 'modes.quickDesc', minPlan: 'free' },
  { id: 'balanced', labelKey: 'modes.balanced', descriptionKey: 'modes.balancedDesc', minPlan: 'free' },
  { id: 'thorough', labelKey: 'modes.thorough', descriptionKey: 'modes.thoroughDesc', minPlan: 'plus' },
];

const PLAN_HIERARCHY: Record<PlanType, number> = { free: 0, plus: 1, pro: 2 };

export function isModeAvailable(modeId: ModeId, userPlan: string): boolean {
  const mode = AVAILABLE_MODES.find((m) => m.id === modeId);
  if (!mode) return false;
  const userLevel = PLAN_HIERARCHY[userPlan as PlanType] ?? 0;
  const requiredLevel = PLAN_HIERARCHY[mode.minPlan];
  return userLevel >= requiredLevel;
}
