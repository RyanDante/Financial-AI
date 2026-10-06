import { View } from 'react-native';
import { AmountText, Body, Caption, IconCircle } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import type { Category, Transaction } from '@/types/finance';

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TransactionRow({ transaction, category }: TransactionRowProps) {
  const colors = useThemeColors();
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

  if (isTransfer) {
    // Moves money between your own accounts: neither spending nor income, so no sign and no category.
    return (
      <View className="flex-row items-center gap-md py-sm">
        <IconCircle name="swap-horizontal" color={colors['accent-secondary']} backgroundColor={`${colors['accent-secondary']}26`} />
        <View className="flex-1">
          <Body numberOfLines={1}>{transaction.description || 'Transfer'}</Body>
          <Caption>Transfer · {formatDate(transaction.occurredAt)}</Caption>
        </View>
        <AmountText valueMinor={transaction.amountMinor} currency={transaction.currency} size="sm" tone="accentSecondary" />
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-md py-sm">
      <IconCircle
        name={(category?.icon ?? 'ellipsis-horizontal') as never}
        color={category?.color ?? undefined}
        backgroundColor={category?.color ? `${category.color}26` : undefined}
      />
      <View className="flex-1">
        <Body numberOfLines={1}>{transaction.merchant || transaction.description || category?.name || 'Transaction'}</Body>
        <Caption>
          {category?.name ?? 'Uncategorized'} · {formatDate(transaction.occurredAt)}
        </Caption>
      </View>
      <AmountText
        valueMinor={isIncome ? transaction.amountMinor : -transaction.amountMinor}
        currency={transaction.currency}
        size="sm"
        tone={isIncome ? 'success' : 'primary'}
        forceSign={isIncome}
      />
    </View>
  );
}
