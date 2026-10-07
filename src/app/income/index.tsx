import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AmountText, Body, Button, Caption, Card, EmptyState, IconCircle } from '@/components/ui';
import { incomeRepository } from '@/database/repositories';
import { useIncome } from '@/features/income/useIncome';
import { nextPayday } from '@/features/allowance/allowance';
import { FREQUENCY_LABELS, nextOccurrence } from '@/features/bills/bills';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { calendarDaysUntil } from '@/utils/months';
import type { IncomeSource } from '@/types/finance';
import { getLocale, useT } from '@/i18n';

/** Salary and other regular income. The next payday drives the daily allowance on Overview. */
export default function IncomeScreen() {
  const colors = useThemeColors();
  const { t, tn } = useT();
  const sources = useIncome();
  const loadAll = useFinanceStore((s) => s.loadAll);
  const payday = nextPayday(sources);

  const stopTracking = (source: IncomeSource) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t('income.stopTitle', { name: source.source }), t('income.stopBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('bills.stop'),
        style: 'destructive',
        onPress: async () => {
          await incomeRepository.setIncomeSourceActive(source.id, false);
          await loadAll();
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/income/new')} accessibilityRole="button" accessibilityLabel={t('nav.addIncome')} hitSlop={8} className="h-11 w-11 items-end justify-center">
              <Ionicons name="add" size={26} color={colors['text-primary']} />
            </Pressable>
          ),
        }}
      />

      {sources.length === 0 ? (
        <Card className="gap-md">
          <EmptyState icon="cash-outline" title={t('income.none')} description={t('income.noneHint')} />
          <Button label={t('nav.addIncome')} onPress={() => router.push('/income/new')} />
        </Card>
      ) : (
        <>
          {payday ? (
            <Card className="gap-xs">
              <Caption>{t('income.nextPayday')}</Caption>
              <Body className="font-sans-semibold">
                {payday.date.toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
                {payday.inDays === 0 ? t('alert.when.today') : payday.inDays === 1 ? t('alert.when.tomorrow') : tn('alert.when.inDays', payday.inDays)}
              </Body>
              <Caption>{payday.source}</Caption>
            </Card>
          ) : null}

          <Card>
            {sources.map((source, i) => {
              const next = source.nextExpectedAt ? nextOccurrence(new Date(source.nextExpectedAt), source.frequency) : null;
              return (
                <Pressable
                  key={source.id}
                  onPress={() => stopTracking(source)}
                  accessibilityRole="button"
                  accessibilityHint={t('income.stopHint')}
                  className={i === 0 ? 'flex-row items-center gap-md py-md' : 'flex-row items-center gap-md border-t border-border py-md'}
                >
                  <IconCircle name="cash-outline" size={32} color={colors.success} backgroundColor={colors['success-muted']} />
                  <View className="flex-1">
                    <Body numberOfLines={1}>{source.source}</Body>
                    <Caption>
                      {FREQUENCY_LABELS[source.frequency]}
                      {next
                        ? t('income.next', { date: next.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }), days: tn('common.days', calendarDaysUntil(next)) })
                        : t('income.noDate')}
                    </Caption>
                  </View>
                  <AmountText valueMinor={source.amountMinor} currency={source.currency} size="sm" tone="success" />
                </Pressable>
              );
            })}
          </Card>
          <Caption>{t('income.tapHint')}</Caption>
        </>
      )}
    </ScrollView>
  );
}
