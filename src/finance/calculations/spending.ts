import type { MinorUnits } from '@/utils/currency';
import type { Category, Transaction } from '@/types/finance';

/** "YYYY-MM" extracted from an ISO timestamp. */
function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Total expense transactions for a given "YYYY-MM" month. */
export function calculateMonthlySpending(transactions: Transaction[], month: string): MinorUnits {
  return transactions
    .filter((tx) => tx.type === 'expense' && monthOf(tx.occurredAt) === month)
    .reduce((sum, tx) => sum + tx.amountMinor, 0);
}

export interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  totalMinor: MinorUnits;
  percentage: number;
  transactionCount: number;
}

/**
 * Groups expense transactions by category and ranks them by share of total
 * spending — the basis for "where is my money going?" / "which categories
 * cost me the most?" answers.
 */
export function calculateSpendingByCategory(transactions: Transaction[], categories: Category[]): CategorySpending[] {
  const expenses = transactions.filter((tx) => tx.type === 'expense');
  const totalMinor = expenses.reduce((sum, tx) => sum + tx.amountMinor, 0);

  const byCategory = new Map<string, { totalMinor: MinorUnits; count: number }>();
  for (const tx of expenses) {
    const key = tx.categoryId ?? 'uncategorized';
    const entry = byCategory.get(key) ?? { totalMinor: 0, count: 0 };
    entry.totalMinor += tx.amountMinor;
    entry.count += 1;
    byCategory.set(key, entry);
  }

  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const result: CategorySpending[] = Array.from(byCategory.entries()).map(([categoryId, entry]) => ({
    categoryId: categoryId === 'uncategorized' ? null : categoryId,
    categoryName: categoryId === 'uncategorized' ? 'Uncategorized' : nameById.get(categoryId) ?? 'Unknown',
    totalMinor: entry.totalMinor,
    percentage: totalMinor === 0 ? 0 : (entry.totalMinor / totalMinor) * 100,
    transactionCount: entry.count,
  }));

  return result.sort((a, b) => b.totalMinor - a.totalMinor);
}

export interface CashFlow {
  incomeMinor: MinorUnits;
  expenseMinor: MinorUnits;
  netMinor: MinorUnits;
}

/** Income vs. expense (and the net) for a given "YYYY-MM" month. */
export function calculateCashFlow(transactions: Transaction[], month: string): CashFlow {
  const monthTransactions = transactions.filter((tx) => monthOf(tx.occurredAt) === month);
  const incomeMinor = monthTransactions.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amountMinor, 0);
  const expenseMinor = monthTransactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amountMinor, 0);
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}
