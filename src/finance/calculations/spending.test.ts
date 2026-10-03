import { calculateCashFlow, calculateMonthlySpending, calculateSpendingByCategory } from './spending';
import type { Category, Transaction } from '@/types/finance';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-' + Math.random(),
    accountId: 'acc-1',
    categoryId: null,
    transferAccountId: null,
    amountMinor: 0,
    currency: 'XAF',
    type: 'expense',
    merchant: null,
    description: null,
    notes: null,
    occurredAt: '2026-01-15T00:00:00.000Z',
    source: 'manual',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateMonthlySpending', () => {
  it('sums only expense transactions within the given month', () => {
    const transactions = [
      tx({ type: 'expense', amountMinor: 1000, occurredAt: '2026-02-01T00:00:00.000Z' }),
      tx({ type: 'expense', amountMinor: 2000, occurredAt: '2026-02-20T00:00:00.000Z' }),
      tx({ type: 'income', amountMinor: 99999, occurredAt: '2026-02-05T00:00:00.000Z' }),
      tx({ type: 'expense', amountMinor: 5000, occurredAt: '2026-03-01T00:00:00.000Z' }),
    ];
    expect(calculateMonthlySpending(transactions, '2026-02')).toBe(3000);
  });

  it('returns 0 for a month with no transactions', () => {
    expect(calculateMonthlySpending([], '2026-02')).toBe(0);
  });
});

describe('calculateSpendingByCategory', () => {
  const categories: Category[] = [
    { id: 'cat-food', name: 'Food', icon: null, color: null, type: 'expense', isDefault: true, parentId: null, createdAt: '', updatedAt: '' },
    { id: 'cat-transport', name: 'Transport', icon: null, color: null, type: 'expense', isDefault: true, parentId: null, createdAt: '', updatedAt: '' },
  ];

  it('groups expenses by category and ranks them by total descending', () => {
    const transactions = [
      tx({ categoryId: 'cat-food', amountMinor: 30000 }),
      tx({ categoryId: 'cat-food', amountMinor: 20000 }),
      tx({ categoryId: 'cat-transport', amountMinor: 10000 }),
      tx({ type: 'income', categoryId: 'cat-food', amountMinor: 999999 }),
    ];
    const result = calculateSpendingByCategory(transactions, categories);
    expect(result).toEqual([
      { categoryId: 'cat-food', categoryName: 'Food', totalMinor: 50000, percentage: (50000 / 60000) * 100, transactionCount: 2 },
      { categoryId: 'cat-transport', categoryName: 'Transport', totalMinor: 10000, percentage: (10000 / 60000) * 100, transactionCount: 1 },
    ]);
  });

  it('buckets transactions with no category under "Uncategorized"', () => {
    const result = calculateSpendingByCategory([tx({ categoryId: null, amountMinor: 500 })], categories);
    expect(result[0]).toMatchObject({ categoryId: null, categoryName: 'Uncategorized', totalMinor: 500 });
  });

  it('returns an empty array with no expenses', () => {
    expect(calculateSpendingByCategory([], categories)).toEqual([]);
  });
});

describe('calculateCashFlow', () => {
  it('computes income, expense, and net for the given month', () => {
    const transactions = [
      tx({ type: 'income', amountMinor: 200000, occurredAt: '2026-04-01T00:00:00.000Z' }),
      tx({ type: 'expense', amountMinor: 60000, occurredAt: '2026-04-10T00:00:00.000Z' }),
      tx({ type: 'expense', amountMinor: 40000, occurredAt: '2026-05-01T00:00:00.000Z' }),
    ];
    expect(calculateCashFlow(transactions, '2026-04')).toEqual({
      incomeMinor: 200000,
      expenseMinor: 60000,
      netMinor: 140000,
    });
  });
});
