import { useEffect, useState } from 'react';
import { incomeRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import type { IncomeSource } from '@/types/finance';

/** Active income sources (salary, side jobs). Re-read whenever the finance store reloads. */
export function useIncome(): IncomeSource[] {
  const transactions = useFinanceStore((s) => s.transactions);
  const [sources, setSources] = useState<IncomeSource[]>([]);

  useEffect(() => {
    let isCurrent = true;
    incomeRepository.listIncomeSources(true).then((rows) => {
      if (isCurrent) setSources(rows);
    });
    return () => {
      isCurrent = false;
    };
  }, [transactions]);

  return sources;
}
