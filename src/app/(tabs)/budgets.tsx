import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Caption, Card, EmptyState, Label, ScreenHeader } from '@/components/ui';
import { BudgetCategoryRow } from '@/components/finance/BudgetCategoryRow';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { budgetsRepository } from '@/database/repositories';
import { calculateMonthlySpending } from '@/finance/calculations';
import { majorToMinor } from '@/utils/currency';
import type { Budget, BudgetCategory } from '@/types/finance';

const DEFAULT_CATEGORY_LIMIT_MAJOR = 20_000;

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetsScreen() {
  const { categories, transactions } = useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const month = currentMonthKey();

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
      name: 'Monthly budget',
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
      <ScreenHeader title="Budgets" subtitle={month} />

      <View className="px-lg">
        {!budget ? (
          <Card className="gap-md">
            <EmptyState
              icon="pie-chart-outline"
              title="No budget set for this month"
              description={`Create a starting budget across your ${expenseCategories.length} expense categories. You can fine-tune limits later.`}
            />
            <Button label={isCreating ? 'Creating…' : 'Create this month’s budget'} onPress={handleCreateBudget} disabled={isCreating} />
          </Card>
        ) : (
          <Card>
            <Label>Category limits</Label>
            <Caption className="pb-sm">Tap a category to change its limit.</Caption>
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
                  accessibilityHint="Changes this category's monthly limit"
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
