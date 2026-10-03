import type { MinorUnits } from '@/utils/currency';
import type { RecurrenceFrequency, RecurringExpense, Subscription } from '@/types/finance';

const WEEKS_PER_MONTH = 4.345;

/** Converts any recurrence frequency to its monthly-equivalent amount. */
export function toMonthlyEquivalent(amountMinor: MinorUnits, frequency: RecurrenceFrequency): MinorUnits {
  switch (frequency) {
    case 'weekly':
      return Math.round(amountMinor * WEEKS_PER_MONTH);
    case 'monthly':
      return amountMinor;
    case 'yearly':
      return Math.round(amountMinor / 12);
    case 'one_time':
      return 0;
  }
}

export interface RecurringExpensesSummary {
  monthlyTotalMinor: MinorUnits;
  items: (RecurringExpense & { monthlyEquivalentMinor: MinorUnits })[];
}

/** Normalizes all active recurring expenses to a single monthly total, for cash-flow and forecast calculations. */
export function calculateRecurringExpenses(recurringExpenses: RecurringExpense[]): RecurringExpensesSummary {
  const active = recurringExpenses.filter((e) => e.isActive);
  const items = active.map((expense) => ({
    ...expense,
    monthlyEquivalentMinor: toMonthlyEquivalent(expense.amountMinor, expense.frequency),
  }));
  return {
    monthlyTotalMinor: items.reduce((sum, item) => sum + item.monthlyEquivalentMinor, 0),
    items,
  };
}

export interface SubscriptionCostSummary {
  monthlyTotalMinor: MinorUnits;
  yearlyTotalMinor: MinorUnits;
  items: (Subscription & { monthlyEquivalentMinor: MinorUnits })[];
}

/** Normalizes all active subscriptions to monthly/yearly totals, ranked by monthly cost descending ("which subscriptions cost me the most?"). */
export function calculateSubscriptionCost(subscriptions: Subscription[]): SubscriptionCostSummary {
  const active = subscriptions.filter((s) => s.isActive);
  const items = active
    .map((sub) => ({
      ...sub,
      monthlyEquivalentMinor: toMonthlyEquivalent(sub.amountMinor, sub.billingCycle === 'yearly' ? 'yearly' : 'monthly'),
    }))
    .sort((a, b) => b.monthlyEquivalentMinor - a.monthlyEquivalentMinor);

  const monthlyTotalMinor = items.reduce((sum, item) => sum + item.monthlyEquivalentMinor, 0);
  return { monthlyTotalMinor, yearlyTotalMinor: monthlyTotalMinor * 12, items };
}
