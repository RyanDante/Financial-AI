import { LOCK_GRACE_MS, shouldLockOnResume } from './appLock';

describe('shouldLockOnResume', () => {
  const t0 = 1_000_000;
  it('locks after the grace period when enabled', () => {
    expect(shouldLockOnResume(true, t0, t0 + LOCK_GRACE_MS)).toBe(true);
    expect(shouldLockOnResume(true, t0, t0 + LOCK_GRACE_MS - 1)).toBe(false);
  });
  it('never locks when disabled or never backgrounded', () => {
    expect(shouldLockOnResume(false, t0, t0 + 10 * LOCK_GRACE_MS)).toBe(false);
    expect(shouldLockOnResume(true, null, t0)).toBe(false);
  });
});
