/** How long the app may sit in the background before it locks again. */
export const LOCK_GRACE_MS = 60_000;

/**
 * Whether returning to the app should show the lock screen: only when the
 * lock is on and the app spent longer than the grace period in the
 * background (a quick switch to the SMS app to copy a message shouldn't
 * ask for a fingerprint again).
 */
export function shouldLockOnResume(enabled: boolean, backgroundedAt: number | null, now: number, graceMs = LOCK_GRACE_MS): boolean {
  if (!enabled || backgroundedAt === null) return false;
  return now - backgroundedAt >= graceMs;
}
