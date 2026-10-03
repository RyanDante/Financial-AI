import { View } from 'react-native';
import { AmountText, Body, Caption, Card, IconCircle, ProgressBar } from '@/components/ui';
import { calculateGoalProgress } from '@/finance/calculations';
import { formatMoney } from '@/utils/currency';
import type { Goal } from '@/types/finance';

interface GoalCardProps {
  goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  const progress = calculateGoalProgress(goal);

  return (
    <Card className="gap-md">
      <View className="flex-row items-center gap-md">
        <IconCircle name={(goal.icon as any) ?? 'flag'} backgroundColor={goal.color ? `${goal.color}26` : undefined} color={goal.color ?? undefined} />
        <View className="flex-1">
          <Body className="font-sans-semibold">{goal.name}</Body>
          <Caption>
            {progress.isComplete
              ? 'Completed'
              : progress.isOverdue
                ? 'Past deadline'
                : progress.daysRemaining !== null
                  ? `${progress.daysRemaining} days left`
                  : 'No deadline set'}
          </Caption>
        </View>
        <AmountText valueMinor={goal.currentAmountMinor} currency={goal.currency} size="sm" />
      </View>
      <ProgressBar percent={progress.percent} tone={progress.isComplete ? 'success' : progress.isOverdue ? 'danger' : 'accent'} />
      <View className="flex-row justify-between">
        <Caption>{progress.percent.toFixed(0)}% of goal</Caption>
        <Caption>Target: {formatMoney(goal.targetAmountMinor, goal.currency)}</Caption>
      </View>
    </Card>
  );
}
