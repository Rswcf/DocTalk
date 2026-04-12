/**
 * Clear per-account localStorage state so the next user on the same device
 * does not inherit the previous user's documents, last-opened file, or
 * message feedback. Keep device-level preferences.
 *
 * Call this before any signOut() invocation AND when the client detects a
 * session transition to `unauthenticated` (Auth.js session expiry).
 */
const KEEP_KEYS = new Set([
  "doctalk_locale",
  "doctalk_tour_completed",
  "doctalk_analytics_consent",
]);

export function clearAccountStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("doctalk_") && !KEEP_KEYS.has(key)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage access errors (private mode, quota, etc.)
  }
}
