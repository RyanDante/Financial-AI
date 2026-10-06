import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AmountText, Caption, ChipGroup, EmptyState, ScreenHeader } from '@/components/ui';
import { MonthStepper } from '@/components/ui/MonthStepper';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { filterTransactions, type TransactionTypeFilter } from '@/features/transactions/filterTransactions';
import { useMonthTransactions } from '@/features/transactions/useMonthTransactions';
import { calculateMonthlySpending } from '@/finance/calculations';
import { currentMonthKey } from '@/utils/months';
import { useThemeColors } from '@/constants/theme';

const FILTERS: { id: TransactionTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfers' },
];

export default function TransactionsScreen() {
  // `month` lets other screens (e.g. Overview's spending trend) open a specific month.
  const params = useLocalSearchParams<{ month?: string }>();
  const colors = useThemeColors();
  const categories = useFinanceStore((s) => s.categories);
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const { activeTransactionFilter, setTransactionFilter } = useUIStore();
  const [month, setMonth] = useState(params.month ?? currentMonthKey());
  const [query, setQuery] = useState('');
  const { transactions, isLoading } = useMonthTransactions(month);

  // Follow a new `month` param when this tab is opened again from elsewhere (adjusting state during render, not in an effect).
  const [lastMonthParam, setLastMonthParam] = useState(params.month);
  if (params.month !== lastMonthParam) {
    setLastMonthParam(params.month);
    if (params.month) setMonth(params.month);
  }

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const visible = useMemo(
    () => filterTransactions(transactions, { query, type: activeTransactionFilter, categoriesById }),
    [transactions, query, activeTransactionFilter, categoriesById],
  );
  const spentMinor = calculateMonthlySpending(transactions, month);
  const incomeMinor = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amountMinor, 0);
  const isFiltered = query.trim() !== '' || activeTransactionFilter !== 'all';

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Transactions"
        right={
          <Pressable
            onPress={() => router.push('/transaction/new')}
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
            className="h-11 w-11 items-center justify-center rounded-full bg-accent"
          >
            <Ionicons name="add" size={22} color={colors['on-accent']} />
          </Pressable>
        }
      />

      <View className="gap-sm px-lg pb-sm">
        <MonthStepper month={month} onChange={setMonth} />
        <View className="flex-row justify-center gap-lg">
          <Caption>
            Spent <AmountText valueMinor={spentMinor} currency={currency} size="xs" tone="primary" />
          </Caption>
          <Caption>
            Income <AmountText valueMinor={incomeMinor} currency={currency} size="xs" tone="success" />
          </Caption>
        </View>
        <View className="flex-row items-center gap-sm rounded-md border border-border-strong bg-surface px-md">
          <Ionicons name="search" size={16} color={colors['text-muted']} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search merchant or category"
            placeholderTextColor={colors['text-muted']}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search transactions"
            className="flex-1 py-sm text-text-primary"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors['text-muted']} />
            </Pressable>
          ) : null}
        </View>
        <ChipGroup options={FILTERS} selectedId={activeTransactionFilter} onSelect={setTransactionFilter} />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-lg pb-3xl"
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} accessibilityRole="button">
            <TransactionRow transaction={item} category={item.categoryId ? categoriesById.get(item.categoryId) : null} />
          </Pressable>
        )}
        ListEmptyComponent={
          isLoading ? null : isFiltered ? (
            <EmptyState icon="search-outline" title="No matching transactions" description="Try another word or filter, or a different month." />
          ) : (
            <EmptyState icon="receipt-outline" title="No transactions this month" description="Tap + to add one, or step back to an earlier month." />
          )
        }
      />
    </View>
  );
}
