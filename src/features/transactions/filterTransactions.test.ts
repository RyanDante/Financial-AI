import { filterTransactions } from './filterTransactions';
import type { Category, Transaction } from '@/types/finance';

const STAMP = '2026-09-01T00:00:00.000Z';
const food: Category = { id: 'food', name: 'Food', icon: null, color: null, type: 'expense', isDefault: true, parentId: null, createdAt: STAMP, updatedAt: STAMP };
const categoriesById = new Map([[food.id, food]]);

function tx(id: string, overrides: Partial<Transaction>): Transaction {
  return { id, accountId: 'a', categoryId: null, transferAccountId: null, amountMinor: 1_000, currency: 'XAF', type: 'expense', merchant: null, description: null, notes: null, occurredAt: STAMP, source: 'manual', createdAt: STAMP, updatedAt: STAMP, ...overrides };
}

const rows = [
  tx('market', { merchant: 'Marché Mokolo', categoryId: 'food' }),
  tx('salary', { type: 'income', merchant: 'Employer' }),
  tx('move', { type: 'transfer', description: 'Cash → MTN MoMo' }),
  tx('snack', { categoryId: 'food' }),
];

describe('filterTransactions', () => {
  it('returns everything with no query and type "all"', () => {
    expect(filterTransactions(rows, { query: '', type: 'all', categoriesById })).toHaveLength(4);
  });

  it('matches merchant ignoring case and accents', () => {
    expect(filterTransactions(rows, { query: 'MARCHE', type: 'all', categoriesById }).map((t) => t.id)).toEqual(['market']);
  });

  it('matches the category name and the description', () => {
    expect(filterTransactions(rows, { query: 'food', type: 'all', categoriesById }).map((t) => t.id)).toEqual(['market', 'snack']);
    expect(filterTransactions(rows, { query: 'momo', type: 'all', categoriesById }).map((t) => t.id)).toEqual(['move']);
  });

  it('combines the query with the type filter', () => {
    expect(filterTransactions(rows, { query: '', type: 'income', categoriesById }).map((t) => t.id)).toEqual(['salary']);
    expect(filterTransactions(rows, { query: 'food', type: 'income', categoriesById })).toEqual([]);
  });
});
