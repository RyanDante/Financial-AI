import { dailyAllowance, nextDebtDueDate, nextPayday } from './allowance';
import type { IncomeSource } from '@/types/finance';

const ASOF = new Date(2026, 8, 20, 12); // Sun 20 Sep 2026

function income(overrides: Partial<IncomeSource>): IncomeSource {
  return { id: 'i', accountId: null, source: 'Salary', amountMinor: 425_000, currency: 'XAF', frequency: 'monthly', nextExpectedAt: new Date(2026, 8, 28).toISOString(), isActive: true, ...overrides };
}

describe('nextPayday', () => {
  it('picks the soonest active source and rolls past dates forward', () => {
    const payday = nextPayday([income({}), income({ id: 'b', source: 'Side job', frequency: 'weekly', nextExpectedAt: new Date(2026, 8, 4).toISOString() }), income({ id: 'c', isActive: false, nextExpectedAt: new Date(2026, 8, 21).toISOString() })], ASOF);
    expect(payday).toMatchObject({ source: 'Side job', inDays: 5 }); // 4 → 11 → 18 → 25 Sep
  });

  it('returns null without a dated, active source', () => {
    expect(nextPayday([income({ nextExpectedAt: null })], ASOF)).toBeNull();
  });
});

describe('dailyAllowance', () => {
  it('spreads safe-to-spend over the days until payday, rounding down', () => {
    expect(dailyAllowance(50_000, [income({})], ASOF)).toMatchObject({ perDayMinor: 6_250, days: 8 });
  });

  it('never goes negative, and treats payday today as one day', () => {
    expect(dailyAllowance(-20_000, [income({})], ASOF)?.perDayMinor).toBe(0);
    expect(dailyAllowance(9_000, [income({ nextExpectedAt: new Date(2026, 8, 20, 18).toISOString() })], ASOF)).toMatchObject({ perDayMinor: 9_000, days: 1 });
  });

  it('returns null when no payday is known', () => {
    expect(dailyAllowance(50_000, [], ASOF)).toBeNull();
  });
});

describe('nextDebtDueDate', () => {
  it('uses this month when the day is still ahead, otherwise next month, clamped to short months', () => {
    expect(nextDebtDueDate({ dueDayOfMonth: 25 }, ASOF)?.getDate()).toBe(25);
    const nextMonth = nextDebtDueDate({ dueDayOfMonth: 5 }, ASOF);
    expect([nextMonth?.getMonth(), nextMonth?.getDate()]).toEqual([9, 5]);
    const feb = nextDebtDueDate({ dueDayOfMonth: 31 }, new Date(2026, 1, 10));
    expect([feb?.getMonth(), feb?.getDate()]).toEqual([1, 28]);
    expect(nextDebtDueDate({ dueDayOfMonth: null }, ASOF)).toBeNull();
  });
});
