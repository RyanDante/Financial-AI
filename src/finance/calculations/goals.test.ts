import {
  calculateGoalProgress,
  calculateProjectedCompletionDate,
  calculateRequiredMonthlySavings,
  calculateRequiredWeeklySavings,
} from './goals';

// Fixture mirrors the spec's own example: "Buy laptop", target 900,000 XAF,
// currently 250,000 XAF saved.
const laptopGoal = { targetAmountMinor: 900000, currentAmountMinor: 250000, deadline: '2026-04-01T00:00:00.000Z' };
const asOf = new Date('2026-01-01T00:00:00.000Z');

describe('calculateGoalProgress', () => {
  it('computes percent complete and amount remaining', () => {
    const progress = calculateGoalProgress(laptopGoal, asOf);
    expect(progress.percent).toBeCloseTo((250000 / 900000) * 100);
    expect(progress.remainingMinor).toBe(650000);
    expect(progress.isComplete).toBe(false);
    expect(progress.isOverdue).toBe(false);
    expect(progress.daysRemaining).toBe(90);
  });

  it('marks a goal complete once current meets or exceeds the target', () => {
    const progress = calculateGoalProgress({ ...laptopGoal, currentAmountMinor: 900000 }, asOf);
    expect(progress.isComplete).toBe(true);
    expect(progress.percent).toBe(100);
    expect(progress.remainingMinor).toBe(0);
  });

  it('flags an incomplete goal past its deadline as overdue', () => {
    const progress = calculateGoalProgress(laptopGoal, new Date('2026-05-01T00:00:00.000Z'));
    expect(progress.isOverdue).toBe(true);
  });

  it('returns null daysRemaining when there is no deadline', () => {
    expect(calculateGoalProgress({ ...laptopGoal, deadline: null }, asOf).daysRemaining).toBeNull();
  });
});

describe('calculateRequiredMonthlySavings', () => {
  it('computes the monthly contribution needed to hit the deadline', () => {
    expect(calculateRequiredMonthlySavings(laptopGoal, asOf)).toBe(219845);
  });

  it('returns null once the goal is already complete', () => {
    expect(calculateRequiredMonthlySavings({ ...laptopGoal, currentAmountMinor: 900000 }, asOf)).toBeNull();
  });

  it('returns null when the deadline has already passed', () => {
    expect(calculateRequiredMonthlySavings(laptopGoal, new Date('2026-05-01T00:00:00.000Z'))).toBeNull();
  });

  it('returns null when there is no deadline', () => {
    expect(calculateRequiredMonthlySavings({ ...laptopGoal, deadline: null }, asOf)).toBeNull();
  });
});

describe('calculateRequiredWeeklySavings', () => {
  it('computes the weekly contribution needed to hit the deadline', () => {
    expect(calculateRequiredWeeklySavings(laptopGoal, asOf)).toBe(50556);
  });
});

describe('calculateProjectedCompletionDate', () => {
  it('projects forward at a constant monthly contribution', () => {
    const projected = calculateProjectedCompletionDate(laptopGoal, 100000, asOf);
    expect(projected).not.toBeNull();
    expect(projected!.getTime()).toBeGreaterThan(asOf.getTime());
  });

  it('returns the current date immediately when there is nothing left to save', () => {
    const projected = calculateProjectedCompletionDate({ ...laptopGoal, currentAmountMinor: 900000 }, 100000, asOf);
    expect(projected).toEqual(asOf);
  });

  it('returns null when contribution is zero and the goal is incomplete', () => {
    expect(calculateProjectedCompletionDate(laptopGoal, 0, asOf)).toBeNull();
  });
});
