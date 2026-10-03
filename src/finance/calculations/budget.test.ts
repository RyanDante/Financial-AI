import { calculateBudgetRemaining, calculateProjectedEndOfMonthSpending } from './budget';

describe('calculateBudgetRemaining', () => {
  it('computes remaining allowance and percent used', () => {
    expect(calculateBudgetRemaining(100000, 40000)).toEqual({
      limitMinor: 100000,
      spentMinor: 40000,
      remainingMinor: 60000,
      percentUsed: 40,
      isOverBudget: false,
    });
  });

  it('flags when spending exceeds the limit', () => {
    const result = calculateBudgetRemaining(100000, 120000);
    expect(result.remainingMinor).toBe(-20000);
    expect(result.isOverBudget).toBe(true);
    expect(result.percentUsed).toBe(120);
  });

  it('does not divide by zero when the limit is zero', () => {
    expect(calculateBudgetRemaining(0, 5000).percentUsed).toBe(0);
  });
});

describe('calculateProjectedEndOfMonthSpending', () => {
  it('extrapolates the daily average across the full month', () => {
    const result = calculateProjectedEndOfMonthSpending(50000, 10, 30);
    expect(result.dailyAverageMinor).toBe(5000);
    expect(result.projectedTotalMinor).toBe(150000);
  });

  it('returns the amount spent so far when no days have elapsed', () => {
    expect(calculateProjectedEndOfMonthSpending(1000, 0, 30)).toEqual({
      projectedTotalMinor: 1000,
      dailyAverageMinor: 0,
    });
  });
});
