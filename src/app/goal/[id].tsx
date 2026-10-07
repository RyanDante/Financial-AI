import { useCallback, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AmountText, Body, Button, Caption, Card, EmptyState, Heading, IconCircle, Label, ProgressBar } from '@/components/ui';
import { goalsRepository } from '@/database/repositories';
import { calculateGoalProgress } from '@/finance/calculations';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import type { GoalContribution } from '@/types/finance';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { getLocale, useT } from '@/i18n';

/** A goal's progress, its contribution history, and the "Add money" action. */
export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { t, tn } = useT();
  const goal = useFinanceStore((s) => s.goals.find((g) => g.id === id));
  const addGoalContribution = useFinanceStore((s) => s.addGoalContribution);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadContributions = useCallback(async () => {
    if (!id) return;
    const rows = await goalsRepository.listGoalContributions(id);
    setContributions([...rows].reverse()); // newest first
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadContributions();
    }, [loadContributions]),
  );

  if (!goal) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState icon="flag-outline" title={t('goal.notFound')} description={t('goal.notFoundHint')} />
      </View>
    );
  }

  const progress = calculateGoalProgress(goal);
  const statusLine = progress.isComplete
    ? t('goals.completed')
    : progress.isOverdue
      ? t('goals.pastDeadline')
      : progress.daysRemaining !== null
        ? tn('goals.daysLeft', progress.daysRemaining)
        : t('goals.noDeadline');

  const handleAdd = async () => {
    const amountMinor = parseMoneyInput(amountInput, goal.currency);
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('goal.amountError'));
      Haptics.selectionAsync();
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await addGoalContribution(goal.id, amountMinor);
      setAmountInput('');
      await loadContributions();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: '/goal/new', params: { id: goal.id } })} accessibilityRole="button" accessibilityLabel={t('goalForm.editTitle')} hitSlop={8} className="min-h-[44px] justify-center">
              <Body className="font-sans-semibold text-accent-secondary">{t('common.edit')}</Body>
            </Pressable>
          ),
        }}
      />
      <Card variant="raised" className="gap-md">
        <View className="flex-row items-center gap-md">
          <IconCircle
            name={(goal.icon ?? 'flag') as never}
            color={goal.color ?? undefined}
            backgroundColor={goal.color ? `${goal.color}26` : undefined}
          />
          <View className="flex-1">
            <Heading numberOfLines={2}>{goal.name}</Heading>
            <Caption className={progress.isComplete ? 'text-success' : progress.isOverdue ? 'text-danger' : undefined}>{statusLine}</Caption>
          </View>
        </View>
        <AmountText valueMinor={goal.currentAmountMinor} currency={goal.currency} size="lg" tone={progress.isComplete ? 'success' : 'primary'} />
        <ProgressBar percent={progress.percent} tone={progress.isComplete ? 'success' : progress.isOverdue ? 'danger' : 'accent'} />
        <View className="flex-row justify-between">
          <Caption>{t('goal.percentOf', { percent: progress.percent.toFixed(0), amount: formatMoney(goal.targetAmountMinor, goal.currency) })}</Caption>
          <Caption>{progress.isComplete ? t('goal.reached') : t('goal.toGo', { amount: formatMoney(progress.remainingMinor, goal.currency) })}</Caption>
        </View>
      </Card>

      <View className="gap-sm">
        <Label>{t('goal.addMoney', { currency: goal.currency })}</Label>
        <TextInput
          value={amountInput}
          onChangeText={setAmountInput}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors['text-muted']}
          accessibilityLabel={t('goal.addA11y', { currency: goal.currency })}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
        {error ? <Caption className="text-danger">{error}</Caption> : null}
        <Button label={isSaving ? t('goal.adding') : t('goal.add')} onPress={handleAdd} disabled={isSaving} />
      </View>

      <View className="gap-sm">
        <Label>{t('goal.history')}</Label>
        <Card>
          {contributions.length === 0 ? (
            <Caption>{t('goal.noHistory')}</Caption>
          ) : (
            contributions.map((c, index) => (
              <View key={c.id} className={index > 0 ? 'flex-row items-center justify-between border-t border-border py-sm' : 'flex-row items-center justify-between py-sm'}>
                <Caption>{new Date(c.contributedAt).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</Caption>
                <AmountText valueMinor={c.amountMinor} currency={goal.currency} size="sm" tone="success" forceSign />
              </View>
            ))
          )}
        </Card>
      </View>
    </FormScrollView>
  );
}
