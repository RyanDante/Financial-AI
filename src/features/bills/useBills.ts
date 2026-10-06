import { useEffect, useState } from 'react';
import { recurringExpensesRepository, subscriptionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import type { RecurringExpense, Subscription } from '@/types/finance';

export interface Bills {
  subscriptions: Subscription[];
  recurringExpenses: RecurringExpense[];
}

/** Active subscriptions and recurring bills, re-read whenever the finance store reloads. */
export function useBills(): Bills {
  const transactions = useFinanceStore((s) => s.transactions);
  const [bills, setBills] = useState<Bills>({ subscriptions: [], recurringExpenses: [] });

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      const [subscriptions, recurringExpenses] = await Promise.all([
        subscriptionsRepository.listSubscriptions(true),
        recurringExpensesRepository.listRecurringExpenses(true),
      ]);
      if (isCurrent) setBills({ subscriptions, recurringExpenses });
    })();
    return () => {
      isCurrent = false;
    };
  }, [transactions]);

  return bills;
}
