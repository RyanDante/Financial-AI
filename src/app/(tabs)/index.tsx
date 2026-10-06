import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AmountText, Badge, Body, Card, Caption, EmptyState, Label, ProgressBar, ScreenHeader } from '@/components/ui';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { calculateAvailableMoney, calculateGoalProgress } from '@/finance/calculations';
import { useThemeColors } from '@/constants/theme';

export default function HomeScreen() {
  const colors = useThemeColors();
  const { accounts, categories, transactions, goals, totalBalanceMinor, monthlyIncomeMinor, monthlySpendingMinor, savingsRate, upcomingObligationsMinor, reserveTargetMinor, loadAll } =
    useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const availableMoneyMinor = calculateAvailableMoney({
    totalBalanceMinor,
    upcomingObligationsMinor,
    reserveTargetMinor,
  });

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 2);

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors['text-secondary']} />}
      contentContainerClassName="pb-3xl"
    >
      <ScreenHeader
        title="Overview"
        subtitle={accounts.length > 0 ? `${accounts.length} account${accounts.length > 1 ? 's' : ''}` : undefined}
        right={
          <Pressable onPress={() => router.push('/settings')} className="rounded-full p-sm">
            <Ionicons name="settings-outline" size={22} color={colors['text-secondary']} />
          </Pressable>
        }
      />

      <View className="px-lg">
        <Card variant="raised" className="gap-sm">
          <Label>Available to spend safely</Label>
          <AmountText valueMinor={availableMoneyMinor} currency={currency} size="lg" tone={availableMoneyMinor < 0 ? 'danger' : 'primary'} />
          <View className="mt-sm flex-row gap-lg">
            <View className="flex-1">
              <Caption>Total balance</Caption>
              <AmountText valueMinor={totalBalanceMinor} currency={currency} size="sm" />
            </View>
            <View className="flex-1">
              <Caption>Reserve target</Caption>
              <AmountText valueMinor={reserveTargetMinor} currency={currency} size="sm" />
            </View>
          </View>
        </Card>
      </View>

      <View className="flex-row gap-md px-lg pt-lg">
        <Card className="flex-1 gap-xs">
          <Caption>Income this month</Caption>
          <AmountText valueMinor={monthlyIncomeMinor} currency={currency} size="sm" tone="success" />
        </Card>
        <Card className="flex-1 gap-xs">
          <Caption>Spent this month</Caption>
          <AmountText valueMinor={monthlySpendingMinor} currency={currency} size="sm" tone="danger" />
        </Card>
      </View>

      <View className="px-lg pt-lg">
        <Card className="gap-sm">
          <View className="flex-row items-center justify-between">
            <Label>Savings rate</Label>
            <Badge label={`${savingsRate.toFixed(0)}%`} tone={savingsRate >= 20 ? 'success' : savingsRate >= 0 ? 'warning' : 'danger'} />
          </View>
          <ProgressBar percent={Math.max(0, savingsRate)} tone={savingsRate >= 20 ? 'success' : 'warning'} />
        </Card>
      </View>

      {activeGoals.length > 0 ? (
        <View className="gap-sm px-lg pt-lg">
          <Label>Goals</Label>
          {activeGoals.map((goal) => {
            const progress = calculateGoalProgress(goal);
            return (
              <Card key={goal.id} className="gap-sm">
                <View className="flex-row justify-between">
                  <Body>{goal.name}</Body>
                  <Caption>{progress.percent.toFixed(0)}%</Caption>
                </View>
                <ProgressBar percent={progress.percent} tone={progress.isComplete ? 'success' : 'accent'} />
              </Card>
            );
          })}
        </View>
      ) : null}

      <View className="pt-lg">
        <View className="flex-row items-center justify-between px-lg pb-sm">
          <Label>Recent transactions</Label>
          <Pressable onPress={() => router.push('/transactions')}>
            <Caption className="text-accent-secondary">See all</Caption>
          </Pressable>
        </View>
        <View className="px-lg">
          {transactions.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No transactions yet" description="Add your first transaction to see it here." />
          ) : (
            transactions.slice(0, 6).map((tx) => (
              <Pressable key={tx.id} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })}>
                <TransactionRow transaction={tx} category={tx.categoryId ? categoryById.get(tx.categoryId) : null} />
              </Pressable>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
