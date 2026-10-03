import { calculatePurchaseImpact } from './purchase';

// Numbers lifted directly from the product spec's worked example.
const base = {
  currentBalanceMinor: 650000,
  upcomingObligationsMinor: 265000,
  reserveTargetMinor: 150000,
};

describe('calculatePurchaseImpact', () => {
  it('returns facts only — a purchase that still leaves the reserve intact', () => {
    const result = calculatePurchaseImpact({ ...base, purchaseAmountMinor: 100000 });

    expect(result.projectedBalanceMinor).toBe(550000);
    expect(result.availableBeforePurchaseMinor).toBe(235000);
    expect(result.availableAfterPurchaseMinor).toBe(135000);
    expect(result.canCoverObligationsAfterPurchase).toBe(true);
    expect(result.isReserveIntactAfterPurchase).toBe(true);
    expect(result.shortfallMinor).toBe(0);
  });

  it('flags a shortfall when the purchase eats into the reserve', () => {
    const result = calculatePurchaseImpact({ ...base, purchaseAmountMinor: 300000 });

    expect(result.projectedBalanceMinor).toBe(350000);
    expect(result.canCoverObligationsAfterPurchase).toBe(true);
    expect(result.isReserveIntactAfterPurchase).toBe(false);
    expect(result.shortfallMinor).toBe(65000);
  });

  it('flags when the purchase would prevent covering upcoming obligations entirely', () => {
    const result = calculatePurchaseImpact({ ...base, purchaseAmountMinor: 500000 });
    expect(result.canCoverObligationsAfterPurchase).toBe(false);
  });

  it('computes per-goal delay in months based on each goal\'s current monthly contribution', () => {
    const result = calculatePurchaseImpact({
      ...base,
      purchaseAmountMinor: 100000,
      goals: [
        { goalId: 'goal-1', goalName: 'Laptop', monthlyContributionMinor: 50000 },
        { goalId: 'goal-2', goalName: 'No active contribution', monthlyContributionMinor: 0 },
      ],
    });

    expect(result.goalImpacts).toEqual([
      { goalId: 'goal-1', goalName: 'Laptop', monthlyContributionMinor: 50000, delayMonths: 2 },
      { goalId: 'goal-2', goalName: 'No active contribution', monthlyContributionMinor: 0, delayMonths: null },
    ]);
  });

  it('returns an empty goalImpacts array when no goals are passed', () => {
    expect(calculatePurchaseImpact({ ...base, purchaseAmountMinor: 100000 }).goalImpacts).toEqual([]);
  });
});
