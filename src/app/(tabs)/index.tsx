import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AmountText, Badge, Body, Card, Caption, EmptyState, Label, ProgressBar, ScreenHeader } from '@/components/ui';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { RecommendationCarousel } from '@/components/finance/RecommendationCarousel';
import { SpendingInsights } from '@/components/finance/SpendingInsights';
import { useRecommendations } from '@/features/recommendations/useRecommendations';
import { useBills } from '@/features/bills/useBills';
import { formatDue, toBillItems } from '@/features/bills/bills';
import { useDebts, debtTotals } from '@/features/debts/useDebts';
import { useIncome } from '@/features/income/useIncome';
import { dailyAllowance } from '@/features/allowance/allowance';
import { formatMoney } from '@/utils/currency';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { calculateAvailableMoney, calculateGoalProgress } from '@/finance/calculations';
import { useThemeColors } from '@/constants/theme';

export default function HomeScreen() {
  const colors = useThemeColors();
  const { accounts, categories, transactions, goals, totalBalanceMinor, monthlyIncomeMinor, monthlySpendingMinor, savingsRate, upcomingObligationsMinor, reserveTargetMinor, loadAll } =
    useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const recommendations = useRecommendations();
  const { subscriptions, recurringExpenses } = useBills();
  const bills = toBillItems(subscriptions, recurringExpenses);
  const nextBill = bills[0];
  const debts = useDebts();
  const { iOweMinor, owedToMeMinor } = debtTotals(debts, currency);
  const incomeSources = useIncome();
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
  const allowance = dailyAllowance(availableMoneyMinor, incomeSources);

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
      />

      <View className="px-lg">
        <Card variant="raised" className="gap-sm">
          <Label>Available to spend safely</Label>
          <AmountText valueMinor={availableMoneyMinor} currency={currency} size="lg" tone={availableMoneyMinor < 0 ? 'danger' : 'primary'} />
          {allowance ? (
            <Caption className="text-text-secondary">
              About {formatMoney(allowance.perDayMinor, currency)} a day until payday ({allowance.payday.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })})
            </Caption>
          ) : (
            <Pressable onPress={() => router.push('/income/new')} accessibilityRole="button" hitSlop={8}>
              <Caption className="font-sans-semibold text-accent-secondary">Add your payday to see a daily allowance</Caption>
            </Pressable>
          )}
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

      {recommendations.length > 0 ? (
        <View className="gap-sm px-lg pt-lg">
          <Label>Suggestions</Label>
          <RecommendationCarousel
            items={recommendations}
            onAddExpense={(item) =>
              router.push({
                pathname: '/transaction/new',
                params: { ...(item.prefill.categoryId ? { categoryId: item.prefill.categoryId } : {}), ...(item.prefill.merchant ? { merchant: item.prefill.merchant } : {}) },
              })
            }
          />
        </View>
      ) : null}

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

      {debts.length > 0 ? (
        <View className="px-lg pt-lg">
          <Pressable onPress={() => router.push('/debts')} accessibilityRole="button" accessibilityLabel={`Debts: you owe ${formatMoney(iOweMinor, currency)}, owed to you ${formatMoney(owedToMeMinor, currency)}`}>
            <Card className="flex-row items-center gap-md">
              <View className="flex-1 gap-xs">
                <Label>Debts</Label>
                <Caption>
                  You owe <AmountText valueMinor={iOweMinor} currency={currency} size="xs" /> · Owed to you{' '}
                  <AmountText valueMinor={owedToMeMinor} currency={currency} size="xs" tone="success" />
                </Caption>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
            </Card>
          </Pressable>
        </View>
      ) : null}

      <View className="px-lg pt-lg">
        <Pressable onPress={() => router.push('/bills')} accessibilityRole="button" accessibilityLabel="Upcoming bills. Open bills and subscriptions">
          <Card className="flex-row items-center gap-md">
            <View className="flex-1 gap-xs">
              <Label>Upcoming bills</Label>
              {nextBill ? (
                <>
                  <AmountText valueMinor={upcomingObligationsMinor} currency={currency} size="sm" />
                  <Caption numberOfLines={1}>
                    Per month · next: {nextBill.name}, {formatDue(nextBill).toLowerCase()}
                  </Caption>
                </>
              ) : (
                <Caption>Add rent, electricity and subscriptions to plan ahead.</Caption>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
          </Card>
        </Pressable>
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

      <View className="px-lg pt-lg">
        <SpendingInsights currency={currency} />
      </View>

      {activeGoals.length > 0 ? (
        <View className="gap-sm px-lg pt-lg">
          <Label>Goals</Label>
          {activeGoals.map((goal) => {
            const progress = calculateGoalProgress(goal);
            return (
              <Pressable
                key={goal.id}
                onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${goal.name}, ${progress.percent.toFixed(0)}% saved`}
              >
                <Card className="gap-sm">
                  <View className="flex-row justify-between">
                    <Body>{goal.name}</Body>
                    <Caption>{progress.percent.toFixed(0)}%</Caption>
                  </View>
                  <ProgressBar percent={progress.percent} tone={progress.isComplete ? 'success' : 'accent'} />
                </Card>
              </Pressable>
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
