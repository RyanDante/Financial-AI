import { calculateRecurringExpenses, calculateSubscriptionCost, toMonthlyEquivalent } from './recurring';
import type { RecurringExpense, Subscription } from '@/types/finance';

describe('toMonthlyEquivalent', () => {
  it('passes monthly amounts through unchanged', () => {
    expect(toMonthlyEquivalent(10000, 'monthly')).toBe(10000);
  });

  it('converts weekly to monthly using a 4.345 week-per-month average', () => {
    expect(toMonthlyEquivalent(1000, 'weekly')).toBe(Math.round(1000 * 4.345));
  });

  it('converts yearly to monthly by dividing by 12', () => {
    expect(toMonthlyEquivalent(120000, 'yearly')).toBe(10000);
  });

  it('treats one-time amounts as contributing nothing to a recurring monthly total', () => {
    expect(toMonthlyEquivalent(50000, 'one_time')).toBe(0);
  });
});

function expense(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: 'exp-' + Math.random(),
    name: 'Rent',
    categoryId: null,
    amountMinor: 0,
    currency: 'XAF',
    frequency: 'monthly',
    nextDueAt: null,
    isActive: true,
    ...overrides,
  };
}

describe('calculateRecurringExpenses', () => {
  it('sums only active expenses, normalized to monthly', () => {
    const summary = calculateRecurringExpenses([
      expense({ amountMinor: 100000, frequency: 'monthly' }),
      expense({ amountMinor: 120000, frequency: 'yearly' }),
      expense({ amountMinor: 999999, isActive: false }),
    ]);
    expect(summary.monthlyTotalMinor).toBe(110000);
    expect(summary.items).toHaveLength(2);
  });
});

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub-' + Math.random(),
    name: 'Streaming',
    categoryId: null,
    amountMinor: 0,
    currency: 'XAF',
    billingCycle: 'monthly',
    nextBillingAt: null,
    isActive: true,
    ...overrides,
  };
}

describe('calculateSubscriptionCost', () => {
  it('ranks active subscriptions by monthly cost, descending', () => {
    const summary = calculateSubscriptionCost([
      subscription({ name: 'Cheap', amountMinor: 1000, billingCycle: 'monthly' }),
      subscription({ name: 'Expensive', amountMinor: 5000, billingCycle: 'monthly' }),
      subscription({ name: 'Inactive', amountMinor: 999999, isActive: false }),
    ]);
    expect(summary.items.map((i) => i.name)).toEqual(['Expensive', 'Cheap']);
    expect(summary.monthlyTotalMinor).toBe(6000);
    expect(summary.yearlyTotalMinor).toBe(72000);
  });
});
