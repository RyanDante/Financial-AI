import type { MinorUnits } from '@/utils/currency';

export interface BudgetRemaining {
  limitMinor: MinorUnits;
  spentMinor: MinorUnits;
  remainingMinor: MinorUnits;
  percentUsed: number;
  isOverBudget: boolean;
}

/** Remaining allowance in a single budget category, given its limit and what's been spent against it. */
export function calculateBudgetRemaining(limitMinor: MinorUnits, spentMinor: MinorUnits): BudgetRemaining {
  const remainingMinor = limitMinor - spentMinor;
  return {
    limitMinor,
    spentMinor,
    remainingMinor,
    percentUsed: limitMinor <= 0 ? 0 : (spentMinor / limitMinor) * 100,
    isOverBudget: spentMinor > limitMinor,
  };
}

export interface ProjectedEndOfMonthSpending {
  projectedTotalMinor: MinorUnits;
  dailyAverageMinor: MinorUnits;
}

/**
 * Naively projects end-of-month spending by extrapolating the daily average
 * spend-so-far across the rest of the month. An ASSUMPTION-tier figure —
 * it assumes the remaining days spend at the same daily rate as the days
 * already elapsed.
 */
export function calculateProjectedEndOfMonthSpending(
  spentSoFarMinor: MinorUnits,
  daysElapsed: number,
  daysInMonth: number,
): ProjectedEndOfMonthSpending {
  if (daysElapsed <= 0) {
    return { projectedTotalMinor: spentSoFarMinor, dailyAverageMinor: 0 };
  }
  const dailyAverageMinor = spentSoFarMinor / daysElapsed;
  return {
    projectedTotalMinor: Math.round(dailyAverageMinor * daysInMonth),
    dailyAverageMinor: Math.round(dailyAverageMinor),
  };
}
