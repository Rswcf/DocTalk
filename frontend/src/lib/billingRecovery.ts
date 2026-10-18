/** Pending checkout is recovered only through the serialized subscribe route. */
export function needsCheckoutRecovery(state?: { managed_by: string; status: string; can_cancel: boolean } | null): boolean {
  return state?.managed_by === 'stripe' &&
    (state.status === 'pending' || (state.status === 'none' && !state.can_cancel));
}
