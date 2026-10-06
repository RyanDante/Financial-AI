import { useMemo } from 'react';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useBudgetLimits } from '@/features/budgets/useBudgetLimits';
import { useBills } from '@/features/bills/useBills';
import { currentMonthKey } from '@/utils/months';
import { buildRecommendations, type Recommendation } from './recommendations';

/** Cards for the Home suggestions carousel. */
export function useRecommendations(): Recommendation[] {
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const month = currentMonthKey();
  const budgetCategories = useBudgetLimits(month);
  const { subscriptions, recurringExpenses } = useBills();

  return useMemo(
    () => buildRecommendations({ currency, month, categories, transactions, budgetCategories, subscriptions, recurringExpenses }),
    [currency, month, categories, transactions, budgetCategories, subscriptions, recurringExpenses],
  );
}
