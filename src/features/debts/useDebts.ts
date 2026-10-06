import { useEffect, useState } from 'react';
import { debtsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import type { Debt } from '@/types/finance';

/** Every open debt, both directions. Re-read whenever the finance store reloads. */
export function useDebts(): Debt[] {
  const transactions = useFinanceStore((s) => s.transactions);
  const [debts, setDebts] = useState<Debt[]>([]);

  useEffect(() => {
    let isCurrent = true;
    debtsRepository.listDebts().then((rows) => {
      if (isCurrent) setDebts(rows);
    });
    return () => {
      isCurrent = false;
    };
  }, [transactions]);

  return debts;
}

/** Totals per direction, for the Overview row and the Debts page header. Settled debts (0 left) don't count. */
export function debtTotals(debts: Debt[], currency: string): { iOweMinor: number; owedToMeMinor: number } {
  const open = debts.filter((d) => d.remainingMinor > 0 && d.currency === currency);
  return {
    iOweMinor: open.filter((d) => d.direction === 'i_owe').reduce((sum, d) => sum + d.remainingMinor, 0),
    owedToMeMinor: open.filter((d) => d.direction === 'owed_to_me').reduce((sum, d) => sum + d.remainingMinor, 0),
  };
}
