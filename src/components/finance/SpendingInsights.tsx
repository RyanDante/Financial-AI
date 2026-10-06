import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AmountText, Caption, Card, Label, Overline } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { useSpendingInsights } from '@/features/insights/useSpendingInsights';
import { formatMoney } from '@/utils/currency';
import { formatMonthLabel, formatMonthShort } from '@/utils/months';
import type { CurrencyCode } from '@/constants/currencies';

const TREND_HEIGHT = 96;
const MIN_COLUMN = 3; // a month with any spending stays visible

/**
 * Overview's spending insights (ui.md §19): a ranked breakdown of this
 * month's categories and a 6-month spending trend. Built from Views with
 * theme tokens, no chart library. Every bar is labelled with its value, so
 * nothing depends on colour or on reading a bar's length.
 */
export function SpendingInsights({ currency }: { currency: CurrencyCode }) {
  const { month, breakdown, trend } = useSpendingInsights();
  const colors = useThemeColors();
  const [selectedMonth, setSelectedMonth] = useState(month);
  const selected = trend.find((p) => p.month === selectedMonth) ?? trend[trend.length - 1];
  const hasTrend = trend.some((p) => p.totalMinor > 0);

  if (breakdown.length === 0 && !hasTrend) return null;

  return (
    <View className="gap-sm">
      <Label>Where your money went</Label>

      {breakdown.length > 0 ? (
        <Card className="gap-md">
          <Overline>{formatMonthLabel(month)}</Overline>
          {breakdown.map((row) => (
            <View
              key={row.key}
              className="gap-xs"
              accessible
              accessibilityLabel={`${row.label}: ${formatMoney(row.totalMinor, currency)}, ${row.percentage.toFixed(0)} percent of spending`}
            >
              <View className="flex-row items-baseline justify-between gap-md">
                <Caption className="flex-1 text-text-primary" numberOfLines={1}>
                  {row.label}
                </Caption>
                <Caption>
                  <AmountText valueMinor={row.totalMinor} currency={currency} size="xs" /> · {row.percentage.toFixed(0)}%
                </Caption>
              </View>
              <View className="h-2 overflow-hidden rounded-sm bg-surface-elevated">
                <View className="h-full rounded-sm bg-accent" style={{ width: `${Math.max(row.barRatio * 100, 2)}%` }} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {hasTrend && selected ? (
        <Card className="gap-md">
          <View className="flex-row items-end justify-between">
            <View className="gap-xs">
              <Overline>Spent in {formatMonthLabel(selected.month)}</Overline>
              <AmountText valueMinor={selected.totalMinor} currency={currency} size="md" />
            </View>
            <Pressable
              onPress={() => router.navigate({ pathname: '/transactions', params: { month: selected.month } })}
              accessibilityRole="button"
              accessibilityLabel={`See transactions for ${formatMonthLabel(selected.month)}`}
              hitSlop={8}
              className="min-h-[44px] justify-center"
            >
              <Caption className="font-sans-semibold text-accent-secondary">See transactions</Caption>
            </Pressable>
          </View>

          <View className="flex-row items-end gap-sm" style={{ height: TREND_HEIGHT + 20 }}>
            {trend.map((point) => {
              const isSelected = point.month === selected.month;
              return (
                <Pressable
                  key={point.month}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMonth(point.month);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${formatMonthLabel(point.month)}: ${formatMoney(point.totalMinor, currency)}`}
                  className="flex-1 items-center justify-end gap-xs"
                  style={{ height: TREND_HEIGHT + 20 }}
                >
                  <View
                    className="w-full rounded-xs"
                    style={{
                      height: point.totalMinor > 0 ? Math.max(point.heightRatio * TREND_HEIGHT, MIN_COLUMN) : 1,
                      backgroundColor: isSelected ? colors.accent : colors['border-strong'],
                    }}
                  />
                  <Caption className={isSelected ? 'font-sans-semibold text-text-primary' : undefined}>{formatMonthShort(point.month)}</Caption>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
