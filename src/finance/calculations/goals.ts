import type { MinorUnits } from '@/utils/currency';
import type { Goal } from '@/types/finance';

const DAYS_PER_MONTH = 30.44;
const DAYS_PER_WEEK = 7;

export interface GoalProgress {
  percent: number;
  remainingMinor: MinorUnits;
  daysRemaining: number | null;
  isOverdue: boolean;
  isComplete: boolean;
}

/** Progress snapshot for a goal: how far along, how much is left, and time pressure. */
export function calculateGoalProgress(goal: Pick<Goal, 'targetAmountMinor' | 'currentAmountMinor' | 'deadline'>, asOf = new Date()): GoalProgress {
  const remainingMinor = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  const isComplete = goal.currentAmountMinor >= goal.targetAmountMinor;
  const percent = goal.targetAmountMinor <= 0 ? 100 : Math.min(100, (goal.currentAmountMinor / goal.targetAmountMinor) * 100);

  let daysRemaining: number | null = null;
  let isOverdue = false;
  if (goal.deadline) {
    const deadlineDate = new Date(goal.deadline);
    const diffMs = deadlineDate.getTime() - asOf.getTime();
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    isOverdue = daysRemaining < 0 && !isComplete;
  }

  return { percent, remainingMinor, daysRemaining, isOverdue, isComplete };
}

/**
 * Required monthly contribution to hit the goal's deadline. Returns null
 * when there's no deadline, the goal is already complete, or the deadline
 * has already passed (those cases have no well-defined monthly figure).
 */
export function calculateRequiredMonthlySavings(goal: Pick<Goal, 'targetAmountMinor' | 'currentAmountMinor' | 'deadline'>, asOf = new Date()): MinorUnits | null {
  const progress = calculateGoalProgress(goal, asOf);
  if (!goal.deadline || progress.isComplete || progress.isOverdue || progress.daysRemaining === null || progress.daysRemaining <= 0) {
    return null;
  }
  const monthsRemaining = progress.daysRemaining / DAYS_PER_MONTH;
  return Math.ceil(progress.remainingMinor / monthsRemaining);
}

/** Same as calculateRequiredMonthlySavings, expressed as a weekly figure. */
export function calculateRequiredWeeklySavings(goal: Pick<Goal, 'targetAmountMinor' | 'currentAmountMinor' | 'deadline'>, asOf = new Date()): MinorUnits | null {
  const progress = calculateGoalProgress(goal, asOf);
  if (!goal.deadline || progress.isComplete || progress.isOverdue || progress.daysRemaining === null || progress.daysRemaining <= 0) {
    return null;
  }
  const weeksRemaining = progress.daysRemaining / DAYS_PER_WEEK;
  return Math.ceil(progress.remainingMinor / weeksRemaining);
}

/**
 * Projects the date a goal would be reached at a given constant monthly
 * contribution. Returns null if the contribution can never close the gap
 * (zero/negative while a remainder still exists).
 */
export function calculateProjectedCompletionDate(
  goal: Pick<Goal, 'targetAmountMinor' | 'currentAmountMinor'>,
  monthlyContributionMinor: MinorUnits,
  asOf = new Date(),
): Date | null {
  const remainingMinor = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  if (remainingMinor === 0) {
    return asOf;
  }
  if (monthlyContributionMinor <= 0) {
    return null;
  }
  const monthsNeeded = remainingMinor / monthlyContributionMinor;
  const projected = new Date(asOf);
  projected.setDate(projected.getDate() + Math.ceil(monthsNeeded * DAYS_PER_MONTH));
  return projected;
}
