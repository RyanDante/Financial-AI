import { View } from 'react-native';
import { AmountText, Body, Caption, Card, IconCircle, ProgressBar } from '@/components/ui';
import { calculateGoalProgress } from '@/finance/calculations';
import { formatMoney } from '@/utils/currency';
import type { Goal } from '@/types/finance';
import { useT } from '@/i18n';

interface GoalCardProps {
  goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  const progress = calculateGoalProgress(goal);
  const { t, tn } = useT();

  return (
    <Card className="gap-md">
      <View className="flex-row items-center gap-md">
        <IconCircle name={(goal.icon as any) ?? 'flag'} backgroundColor={goal.color ? `${goal.color}26` : undefined} color={goal.color ?? undefined} />
        <View className="flex-1">
          <Body className="font-sans-semibold">{goal.name}</Body>
          <Caption>
            {progress.isComplete
              ? t('goals.completed')
              : progress.isOverdue
                ? t('goals.pastDeadline')
                : progress.daysRemaining !== null
                  ? tn('goals.daysLeft', progress.daysRemaining)
                  : t('goals.noDeadline')}
          </Caption>
        </View>
        <AmountText valueMinor={goal.currentAmountMinor} currency={goal.currency} size="sm" />
      </View>
      <ProgressBar percent={progress.percent} tone={progress.isComplete ? 'success' : progress.isOverdue ? 'danger' : 'accent'} />
      <View className="flex-row justify-between">
        <Caption>{t('goals.percentOfGoal', { percent: progress.percent.toFixed(0) })}</Caption>
        <Caption>{t('goals.target', { amount: formatMoney(goal.targetAmountMinor, goal.currency) })}</Caption>
      </View>
    </Card>
  );
}
