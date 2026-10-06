import { useEffect, useMemo, useState } from 'react';
import { budgetsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSyncStore } from '@/store/syncStore';
import type { BudgetCategory } from '@/types/finance';
import { buildAlerts, type Alert } from './alerts';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The live alert list for the AppBar bell and the Alerts screen. Reads only
 * existing stores plus this month's budget limits (the same query the
 * Budgets tab runs), and re-reads the limits whenever transactions change.
 */
export function useAlerts(): Alert[] {
  const { categories, transactions, goals, totalBalanceMinor, upcomingObligationsMinor, reserveTargetMinor } = useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const syncStatus = useSyncStore((s) => s.status);
  const syncErrorMessage = useSyncStore((s) => s.errorMessage);
  const attachmentUploadError = useSyncStore((s) => s.attachmentUploadError);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const month = currentMonthKey();

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      const budget = await budgetsRepository.getBudgetForMonth(month);
      const limits = budget ? await budgetsRepository.listBudgetCategories(budget.id) : [];
      if (isCurrent) setBudgetCategories(limits);
    })();
    return () => {
      isCurrent = false;
    };
  }, [month, transactions]);

  return useMemo(
    () =>
      buildAlerts({
        currency,
        month,
        categories,
        transactions,
        goals,
        budgetCategories,
        totalBalanceMinor,
        upcomingObligationsMinor,
        reserveTargetMinor,
        syncStatus,
        syncErrorMessage,
        attachmentUploadError,
      }),
    [currency, month, categories, transactions, goals, budgetCategories, totalBalanceMinor, upcomingObligationsMinor, reserveTargetMinor, syncStatus, syncErrorMessage, attachmentUploadError],
  );
}
