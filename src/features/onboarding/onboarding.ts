/** Setting key written when the first-run setup is finished or skipped. */
export const ONBOARDED_KEY = 'onboarded';

/**
 * Show the first-run setup only to someone who hasn't seen it AND has no
 * transactions yet, so people who used F-AI before this setup existed
 * aren't sent through it.
 */
export function needsOnboarding(onboardedSetting: string | null, transactionCount: number): boolean {
  return onboardedSetting === null && transactionCount === 0;
}
