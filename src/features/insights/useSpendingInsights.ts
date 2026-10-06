import { useEffect, useMemo, useState } from 'react';
import { transactionsRepository } from '@/database/repositories';
import { calculateSpendingByCategory } from '@/finance/calculations';
import { useFinanceStore } from '@/store/financeStore';
import { currentMonthKey, isInMonth, monthRange, shiftMonth } from '@/utils/months';
import type { Transaction } from '@/types/finance';
import { toBreakdownRows, toTrendPoints, type BreakdownRow, type TrendPoint } from './insights';

export const TREND_MONTHS = 6;

export interface SpendingInsights {
  month: string;
  breakdown: BreakdownRow[];
  trend: TrendPoint[];
}

/**
 * This month's category breakdown and the last 6 months' spending, from one
 * range query (the store keeps only the latest 200 transactions). Re-reads
 * whenever the store reloads.
 */
export function useSpendingInsights(): SpendingInsights {
  const categories = useFinanceStore((s) => s.categories);
  const storeTransactions = useFinanceStore((s) => s.transactions);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const month = currentMonthKey();

  const months = useMemo(() => Array.from({ length: TREND_MONTHS }, (_, i) => shiftMonth(month, i - (TREND_MONTHS - 1))), [month]);

  useEffect(() => {
    let isCurrent = true;
    transactionsRepository
      .listTransactions({ type: 'expense', from: monthRange(months[0]).from, to: monthRange(month).to })
      .then((rows) => {
        if (isCurrent) setTransactions(rows);
      });
    return () => {
      isCurrent = false;
    };
  }, [months, month, storeTransactions]);

  return useMemo(
    () => ({
      month,
      breakdown: toBreakdownRows(calculateSpendingByCategory(transactions.filter((tx) => isInMonth(tx.occurredAt, month)), categories)),
      trend: toTrendPoints(transactions, months),
    }),
    [month, months, transactions, categories],
  );
}
