import type { Category, Transaction, TransactionType } from '@/types/finance';

export type TransactionTypeFilter = 'all' | TransactionType;

export interface TransactionFilterInput {
  /** Matched case-insensitively against merchant, description and category name. */
  query: string;
  type: TransactionTypeFilter;
  categoriesById: Map<string, Category>;
}

/** The Transactions tab's search and type filter, applied to one month's rows. */
export function filterTransactions(transactions: Transaction[], { query, type, categoriesById }: TransactionFilterInput): Transaction[] {
  const needle = normalize(query);
  return transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (!needle) return true;
    const categoryName = tx.categoryId ? categoriesById.get(tx.categoryId)?.name : undefined;
    return [tx.merchant, tx.description, categoryName].some((field) => field && normalize(field).includes(needle));
  });
}

/** Lowercase and strip accents, so "marche" finds "Marché". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
