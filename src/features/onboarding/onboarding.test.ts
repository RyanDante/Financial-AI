import { needsOnboarding } from './onboarding';

describe('needsOnboarding', () => {
  it('shows setup only to new users with no history', () => {
    expect(needsOnboarding(null, 0)).toBe(true);
    expect(needsOnboarding(null, 12)).toBe(false); // existing user from before setup existed
    expect(needsOnboarding('true', 0)).toBe(false); // finished or skipped
  });
});
