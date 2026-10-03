import type { MinorUnits } from '@/utils/currency';

/** Percentage of income retained after spending. Returns 0 when income is 0 (undefined rate, not infinite). */
export function calculateSavingsRate(totalIncomeMinor: MinorUnits, totalSpendingMinor: MinorUnits): number {
  if (totalIncomeMinor <= 0) {
    return 0;
  }
  return ((totalIncomeMinor - totalSpendingMinor) / totalIncomeMinor) * 100;
}

/** Recommended emergency reserve: N months of essential (non-discretionary) expenses, defaulting to 3. */
export function calculateEmergencyReserve(monthlyEssentialExpensesMinor: MinorUnits, monthsOfCoverage = 3): MinorUnits {
  return Math.round(monthlyEssentialExpensesMinor * monthsOfCoverage);
}

export interface EmergencyReserveStatus {
  targetMinor: MinorUnits;
  currentMinor: MinorUnits;
  shortfallMinor: MinorUnits;
  isMet: boolean;
  percentFunded: number;
}

/** Compares the current balance earmarked for reserve against the target, as plain facts. */
export function calculateEmergencyReserveStatus(currentReserveMinor: MinorUnits, targetMinor: MinorUnits): EmergencyReserveStatus {
  const shortfallMinor = Math.max(0, targetMinor - currentReserveMinor);
  return {
    targetMinor,
    currentMinor: currentReserveMinor,
    shortfallMinor,
    isMet: currentReserveMinor >= targetMinor,
    percentFunded: targetMinor <= 0 ? 100 : Math.min(100, (currentReserveMinor / targetMinor) * 100),
  };
}
