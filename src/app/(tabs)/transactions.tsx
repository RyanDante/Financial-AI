import { FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, Label, ScreenHeader } from '@/components/ui';
import { TransactionRow } from '@/components/finance/TransactionRow';
import { useFinanceStore } from '@/store/financeStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { useThemeColors } from '@/constants/theme';

const FILTERS: { key: 'all' | 'income' | 'expense'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
];

export default function TransactionsScreen() {
  const colors = useThemeColors();
  const { transactions, categories } = useFinanceStore();
  const { activeTransactionFilter, setTransactionFilter } = useUIStore();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const filtered = transactions.filter((tx) => activeTransactionFilter === 'all' || tx.type === activeTransactionFilter);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Transactions"
        right={
          <Pressable onPress={() => router.push('/transaction/new')} className="rounded-full bg-accent p-sm">
            <Ionicons name="add" size={20} color={colors['on-accent']} />
          </Pressable>
        }
      />

      <View className="flex-row gap-sm px-lg pb-md">
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setTransactionFilter(filter.key)}
            className={cn(
              'rounded-sm border px-md py-xs',
              activeTransactionFilter === filter.key ? 'border-accent bg-accent-muted' : 'border-border bg-surface',
            )}
          >
            <Label className={activeTransactionFilter === filter.key ? 'text-accent-secondary' : undefined}>{filter.label}</Label>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-lg pb-3xl"
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}>
            <TransactionRow transaction={item} category={item.categoryId ? categoryById.get(item.categoryId) : null} />
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No transactions" description="Tap + to add your first one." />}
      />
    </View>
  );
}
