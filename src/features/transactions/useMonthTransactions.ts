import { useEffect, useState } from 'react';
import { transactionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { isInMonth, monthRange } from '@/utils/months';
import type { Transaction } from '@/types/finance';

/**
 * Every transaction in one month, read straight from the database (the
 * store only keeps the latest 200). Re-reads whenever the store reloads, so
 * adds, edits and deletes show up immediately.
 */
export function useMonthTransactions(month: string): { transactions: Transaction[]; isLoading: boolean } {
  const storeTransactions = useFinanceStore((s) => s.transactions);
  const [state, setState] = useState<{ month: string; transactions: Transaction[] } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const { from, to } = monthRange(month);
    transactionsRepository.listTransactions({ from, to }).then((rows) => {
      if (isCurrent) setState({ month, transactions: rows.filter((tx) => isInMonth(tx.occurredAt, month)) });
    });
    return () => {
      isCurrent = false;
    };
  }, [month, storeTransactions]);

  // While a different month is loading, show nothing rather than the previous month's rows.
  const isLoading = state?.month !== month;
  return { transactions: isLoading ? [] : (state?.transactions ?? []), isLoading };
}
