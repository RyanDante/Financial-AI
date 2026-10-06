import { budgetWarnings, planReminders } from './reminders';
import { toBillItems } from '@/features/bills/bills';
import type { Debt } from '@/types/finance';

const ASOF = new Date(2026, 8, 20, 12); // 20 Sep 2026, noon

describe('planReminders', () => {
  const rent = { id: 'r', name: 'Rent', categoryId: null, amountMinor: 120_000, currency: 'XAF' as const, frequency: 'monthly' as const, nextDueAt: new Date(2026, 8, 25).toISOString(), isActive: true };
  const tomorrow = { ...rent, id: 't', name: 'Water', nextDueAt: new Date(2026, 8, 21).toISOString() };
  const loan: Debt = { id: 'd', name: 'Phone loan', direction: 'i_owe', counterparty: 'Afriland', principalMinor: 100_000, remainingMinor: 60_000, currency: 'XAF', interestRate: 0, minimumPaymentMinor: 20_000, dueDayOfMonth: 28 };
  const lent: Debt = { ...loan, id: 'l', direction: 'owed_to_me', counterparty: 'Paul' };

  it('reminds at 9:00 the day before each bill and debt payment, soonest first', () => {
    const reminders = planReminders(toBillItems([], [rent], ASOF), [loan, lent], ASOF);
    expect(reminders.map((r) => [r.id, r.date.getDate(), r.date.getHours()])).toEqual([
      ['bill-recurring-r', 24, 9],
      ['debt-d', 27, 9],
    ]);
    expect(reminders[0]).toMatchObject({ title: 'Rent is due tomorrow', body: "120,000 FCFA. Make sure it's set aside." });
    expect(reminders[1].body).toBe('20,000 FCFA to pay.');
  });

  it("skips a reminder whose time has passed, and money owed to you", () => {
    // Water is due tomorrow: its reminder (today 09:00) is already past at noon.
    expect(planReminders(toBillItems([], [tomorrow], ASOF), [lent], ASOF)).toEqual([]);
  });
});

describe('budgetWarnings', () => {
  const usage = [
    { categoryId: 'food', categoryName: 'Food', limitMinor: 100_000, spentMinor: 90_000, currency: 'XAF' as const },
    { categoryId: 'fun', categoryName: 'Entertainment', limitMinor: 20_000, spentMinor: 25_000, currency: 'XAF' as const },
    { categoryId: 'bus', categoryName: 'Transport', limitMinor: 50_000, spentMinor: 10_000, currency: 'XAF' as const },
  ];

  it('warns at 85% and over, once per category per month', () => {
    const warnings = budgetWarnings(usage, '2026-09', new Set(['2026-09:fun']));
    expect(warnings).toEqual([{ key: '2026-09:food', title: 'Food budget is 90% used', body: '10,000 FCFA left for the rest of the month.' }]);
    expect(budgetWarnings(usage, '2026-10', new Set(['2026-09:fun', '2026-09:food'])).map((w) => w.title)).toEqual(['Food budget is 90% used', 'Entertainment is over budget']);
  });
});
