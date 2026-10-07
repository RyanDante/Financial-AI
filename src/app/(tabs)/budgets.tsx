import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Caption, Card, EmptyState, Label, ScreenHeader } from '@/components/ui';
import { BudgetCategoryRow } from '@/components/finance/BudgetCategoryRow';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { budgetsRepository } from '@/database/repositories';
import { MonthStepper } from '@/components/ui/MonthStepper';
import { useMonthTransactions } from '@/features/transactions/useMonthTransactions';
import { currentMonthKey } from '@/utils/months';
import { calculateMonthlySpending } from '@/finance/calculations';
import { majorToMinor } from '@/utils/currency';
import type { Budget, BudgetCategory } from '@/types/finance';
import { useT } from '@/i18n';

const DEFAULT_CATEGORY_LIMIT_MAJOR = 20_000;

export default function BudgetsScreen() {
  const categories = useFinanceStore((s) => s.categories);
  const { t } = useT();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [month, setMonth] = useState(currentMonthKey());
  const isCurrentMonth = month === currentMonthKey();
  const { transactions } = useMonthTransactions(month);

  // Reload on focus so a limit changed in the budget/limit modal shows on return.
  useFocusEffect(
    useCallback(() => {
      let isCurrent = true;
      (async () => {
        const existing = await budgetsRepository.getBudgetForMonth(month);
        const existingCategories = existing ? await budgetsRepository.listBudgetCategories(existing.id) : [];
        if (isCurrent) {
          setBudget(existing);
          setBudgetCategories(existingCategories);
        }
      })();
      return () => {
        isCurrent = false;
      };
    }, [month]),
  );

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const handleCreateBudget = async () => {
    setIsCreating(true);
    const created = await budgetsRepository.createBudget({
      name: t('budgets.defaultName'),
      month,
      currency,
      categories: expenseCategories.map((category) => ({
        categoryId: category.id,
        limitMinor: majorToMinor(DEFAULT_CATEGORY_LIMIT_MAJOR, currency),
      })),
    });
    setBudget(created);
    setBudgetCategories(await budgetsRepository.listBudgetCategories(created.id));
    setIsCreating(false);
  };

  const spentByCategory = (categoryId: string) => calculateMonthlySpending(transactions.filter((tx) => tx.categoryId === categoryId), month);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-3xl">
      <ScreenHeader title={t('nav.budgets')} />
      <View className="px-lg pb-sm">
        <MonthStepper month={month} onChange={setMonth} />
      </View>

      <View className="px-lg">
        {!budget ? (
          <Card className="gap-md">
            <EmptyState
              icon="pie-chart-outline"
              title={isCurrentMonth ? t('budgets.noneCurrent') : t('budgets.nonePast')}
              description={
                isCurrentMonth
                  ? t('budgets.createHint', { count: expenseCategories.length })
                  : t('budgets.pastHint')
              }
            />
            {isCurrentMonth ? (
              <Button label={isCreating ? t('budgets.creating') : t('budgets.create')} onPress={handleCreateBudget} disabled={isCreating} />
            ) : null}
          </Card>
        ) : (
          <Card>
            <Label>{t('budgets.limits')}</Label>
            <Caption className="pb-sm">{t('budgets.tapToChange')}</Caption>
            {budgetCategories.map((bc) => {
              const category = categoryById.get(bc.categoryId);
              if (!category) return null;
              return (
                <Pressable
                  key={bc.id}
                  onPress={() =>
                    router.push({
                      pathname: '/budget/limit',
                      params: { budgetCategoryId: bc.id, categoryId: bc.categoryId, limitMinor: String(bc.limitMinor), currency: budget.currency },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityHint={t('budgets.changeHint')}
                >
                  <BudgetCategoryRow category={category} limitMinor={bc.limitMinor} spentMinor={spentByCategory(bc.categoryId)} currency={budget.currency} />
                </Pressable>
              );
            })}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
