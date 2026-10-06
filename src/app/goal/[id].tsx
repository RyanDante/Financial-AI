import { useCallback, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AmountText, Button, Caption, Card, EmptyState, Heading, IconCircle, Label, ProgressBar } from '@/components/ui';
import { goalsRepository } from '@/database/repositories';
import { calculateGoalProgress } from '@/finance/calculations';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import type { GoalContribution } from '@/types/finance';

/** A goal's progress, its contribution history, and the "Add money" action. */
export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
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
        <EmptyState icon="flag-outline" title="Goal not found" description="It may have been removed on another device." />
      </View>
    );
  }

  const progress = calculateGoalProgress(goal);
  const statusLine = progress.isComplete
    ? 'Completed'
    : progress.isOverdue
      ? 'Past deadline'
      : progress.daysRemaining !== null
        ? `${progress.daysRemaining} days left`
        : 'No deadline set';

  const handleAdd = async () => {
    const amountMinor = parseMoneyInput(amountInput, goal.currency);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than 0.');
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
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl" keyboardShouldPersistTaps="handled">
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
          <Caption>{progress.percent.toFixed(0)}% of {formatMoney(goal.targetAmountMinor, goal.currency)}</Caption>
          <Caption>{progress.isComplete ? 'Target reached' : `${formatMoney(progress.remainingMinor, goal.currency)} to go`}</Caption>
        </View>
      </Card>

      <View className="gap-sm">
        <Label>Add money ({goal.currency})</Label>
        <TextInput
          value={amountInput}
          onChangeText={setAmountInput}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors['text-muted']}
          accessibilityLabel={`Amount to add, in ${goal.currency}`}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
        {error ? <Caption className="text-danger">{error}</Caption> : null}
        <Button label={isSaving ? 'Adding…' : 'Add money'} onPress={handleAdd} disabled={isSaving} />
      </View>

      <View className="gap-sm">
        <Label>History</Label>
        <Card>
          {contributions.length === 0 ? (
            <Caption>No money added yet. The starting amount you set when creating the goal is included in the total.</Caption>
          ) : (
            contributions.map((c, index) => (
              <View key={c.id} className={index > 0 ? 'flex-row items-center justify-between border-t border-border py-sm' : 'flex-row items-center justify-between py-sm'}>
                <Caption>{new Date(c.contributedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Caption>
                <AmountText valueMinor={c.amountMinor} currency={goal.currency} size="sm" tone="success" forceSign />
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
