import { View } from 'react-native';
import { AmountText, Body, Caption, IconCircle } from '@/components/ui';
import type { Category, Transaction } from '@/types/finance';

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TransactionRow({ transaction, category }: TransactionRowProps) {
  const isIncome = transaction.type === 'income';
  const tone = isIncome ? 'success' : transaction.type === 'transfer' ? 'primary' : 'primary';

  return (
    <View className="flex-row items-center gap-md py-sm">
      <IconCircle
        name={(category?.icon as any) ?? 'ellipsis-horizontal'}
        color={category?.color ?? '#9D9DAB'}
        backgroundColor={category?.color ? `${category.color}26` : '#2A2A34'}
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
        tone={tone}
        forceSign={isIncome}
      />
    </View>
  );
}
