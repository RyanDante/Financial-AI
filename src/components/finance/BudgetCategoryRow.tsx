import { View } from 'react-native';
import { Caption, IconCircle, Label, ProgressBar } from '@/components/ui';
import { calculateBudgetRemaining } from '@/finance/calculations';
import { formatMoney } from '@/utils/currency';
import type { Category } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface BudgetCategoryRowProps {
  category: Category;
  limitMinor: number;
  spentMinor: number;
  currency: CurrencyCode;
}

export function BudgetCategoryRow({ category, limitMinor, spentMinor, currency }: BudgetCategoryRowProps) {
  const { remainingMinor, percentUsed, isOverBudget } = calculateBudgetRemaining(limitMinor, spentMinor);

  return (
    <View className="gap-sm py-sm">
      <View className="flex-row items-center gap-md">
        <IconCircle name={(category.icon as any) ?? 'ellipsis-horizontal'} color={category.color ?? undefined} backgroundColor={category.color ? `${category.color}26` : undefined} size={32} />
        <Label className="flex-1 text-text-primary">{category.name}</Label>
        <Caption>
          {formatMoney(spentMinor, currency)} / {formatMoney(limitMinor, currency)}
        </Caption>
      </View>
      <ProgressBar percent={percentUsed} tone={isOverBudget ? 'danger' : percentUsed > 85 ? 'warning' : 'accent'} />
      {isOverBudget ? (
        <Caption className="text-danger">{formatMoney(Math.abs(remainingMinor), currency)} over budget</Caption>
      ) : null}
    </View>
  );
}
