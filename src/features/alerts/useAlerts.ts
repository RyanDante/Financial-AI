import { useMemo } from 'react';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSyncStore } from '@/store/syncStore';
import { useBudgetLimits } from '@/features/budgets/useBudgetLimits';
import { currentMonthKey } from '@/utils/months';
import { buildAlerts, type Alert } from './alerts';

/**
 * The live alert list for the AppBar bell and the Alerts screen. Reads only
 * existing stores plus this month's budget limits (useBudgetLimits).
 */
export function useAlerts(): Alert[] {
  const { categories, transactions, goals, totalBalanceMinor, upcomingObligationsMinor, reserveTargetMinor } = useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const syncStatus = useSyncStore((s) => s.status);
  const syncErrorMessage = useSyncStore((s) => s.errorMessage);
  const attachmentUploadError = useSyncStore((s) => s.attachmentUploadError);
  const month = currentMonthKey();
  const budgetCategories = useBudgetLimits(month);

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
