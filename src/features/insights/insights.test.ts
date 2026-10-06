import { toBreakdownRows, toTrendPoints } from './insights';
import type { CategorySpending } from '@/finance/calculations';
import type { Transaction } from '@/types/finance';

function spend(name: string, totalMinor: number, percentage: number): CategorySpending {
  return { categoryId: name.toLowerCase(), categoryName: name, totalMinor, percentage, transactionCount: 1 };
}

describe('toBreakdownRows', () => {
  it('keeps the top categories and folds the rest into Other', () => {
    const rows = toBreakdownRows([spend('Food', 100, 40), spend('Transport', 50, 20), spend('Bills', 40, 16), spend('Health', 30, 12), spend('Shopping', 20, 8), spend('Gaming', 6, 2.4), spend('Education', 4, 1.6)]);
    expect(rows.map((r) => r.label)).toEqual(['Food', 'Transport', 'Bills', 'Health', 'Shopping', 'Other (2)']);
    expect(rows[5]).toMatchObject({ totalMinor: 10, percentage: 4 });
    expect(rows[0].barRatio).toBe(1);
    expect(rows[1].barRatio).toBe(0.5);
  });

  it('returns nothing when there is no spending', () => {
    expect(toBreakdownRows([])).toEqual([]);
    expect(toBreakdownRows([spend('Food', 0, 0)])).toEqual([]);
  });
});

describe('toTrendPoints', () => {
  const STAMP = '2026-01-01T00:00:00.000Z';
  const tx = (occurredAt: string, amountMinor: number, type: Transaction['type'] = 'expense'): Transaction => ({
    id: occurredAt + amountMinor, accountId: 'a', categoryId: null, transferAccountId: null, amountMinor, currency: 'XAF', type, merchant: null, description: null, notes: null, occurredAt, source: 'manual', createdAt: STAMP, updatedAt: STAMP,
  });

  it('totals expenses per month, ignoring income and transfers, scaled to the highest month', () => {
    const points = toTrendPoints(
      [tx('2026-08-03T10:00:00.000Z', 40_000), tx('2026-09-05T10:00:00.000Z', 60_000), tx('2026-09-06T10:00:00.000Z', 20_000), tx('2026-09-07T10:00:00.000Z', 500_000, 'income'), tx('2026-09-08T10:00:00.000Z', 30_000, 'transfer')],
      ['2026-07', '2026-08', '2026-09'],
    );
    expect(points.map((p) => p.totalMinor)).toEqual([0, 40_000, 80_000]);
    expect(points.map((p) => p.heightRatio)).toEqual([0, 0.5, 1]);
  });
});
