import { useEffect, useState } from 'react';
import { budgetsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import type { BudgetCategory } from '@/types/finance';

/**
 * Category limits for one month's budget (empty when none exists). Re-reads
 * whenever the finance store reloads, which every write path triggers via
 * `loadAll()`, so limits edited elsewhere show up without a manual refresh.
 */
export function useBudgetLimits(month: string): BudgetCategory[] {
  const transactions = useFinanceStore((s) => s.transactions);
  const [limits, setLimits] = useState<BudgetCategory[]>([]);

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      const budget = await budgetsRepository.getBudgetForMonth(month);
      const rows = budget ? await budgetsRepository.listBudgetCategories(budget.id) : [];
      if (isCurrent) setLimits(rows);
    })();
    return () => {
      isCurrent = false;
    };
  }, [month, transactions]);

  return limits;
}
