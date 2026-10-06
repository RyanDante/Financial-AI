import type { Ionicons } from '@expo/vector-icons';
import { calculateAvailableMoney, calculateBudgetRemaining, calculateGoalProgress, calculateMonthlySpending } from '@/finance/calculations';
import { formatMoney } from '@/utils/currency';
import type { CurrencyCode } from '@/constants/currencies';
import type { SyncStatus } from '@/services/sync/sync.types';
import type { BudgetCategory, Category, Goal, Transaction } from '@/types/finance';

export type AlertSeverity = 'danger' | 'warning';

/** Where tapping an alert takes the user. Only routes that already exist. */
export type AlertHref = '/' | '/budgets' | '/goals' | '/settings';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  href: AlertHref;
}

export interface AlertInput {
  currency: CurrencyCode;
  /** `YYYY-MM` — the month the budget limits apply to. */
  month: string;
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  /** Limits for `month`'s budget; empty when no budget exists. */
  budgetCategories: BudgetCategory[];
  totalBalanceMinor: number;
  upcomingObligationsMinor: number;
  reserveTargetMinor: number;
  syncStatus: SyncStatus;
  /** Only shown for `blocked`, whose message is written for the user; `error` messages can be raw. */
  syncErrorMessage: string | null;
  attachmentUploadError: string | null;
  asOf?: Date;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { danger: 0, warning: 1 };

/**
 * Things that need the user's attention, derived only from data the app
 * already has (no new storage, no push notifications). Every number comes
 * from the finance engine and is formatted with formatMoney. Danger first,
 * then warnings, each group in the order the sources are listed here.
 */
export function buildAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  const asOf = input.asOf ?? new Date();

  const availableMinor = calculateAvailableMoney({
    totalBalanceMinor: input.totalBalanceMinor,
    upcomingObligationsMinor: input.upcomingObligationsMinor,
    reserveTargetMinor: input.reserveTargetMinor,
  });
  if (availableMinor < 0) {
    alerts.push({
      id: 'available-negative',
      severity: 'danger',
      icon: 'wallet-outline',
      title: 'Nothing safe to spend',
      detail: `Bills and your reserve exceed your balance by ${formatMoney(Math.abs(availableMinor), input.currency)}.`,
      href: '/',
    });
  }

  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  for (const limit of input.budgetCategories) {
    const spentMinor = calculateMonthlySpending(
      input.transactions.filter((tx) => tx.categoryId === limit.categoryId),
      input.month,
    );
    const { isOverBudget, remainingMinor } = calculateBudgetRemaining(limit.limitMinor, spentMinor);
    if (!isOverBudget) continue;
    alerts.push({
      id: `budget-${limit.id}`,
      severity: 'danger',
      icon: 'alert-circle-outline',
      title: `${categoryById.get(limit.categoryId)?.name ?? 'A category'} is over budget`,
      detail: `${formatMoney(Math.abs(remainingMinor), input.currency)} over budget this month.`,
      href: '/budgets',
    });
  }

  for (const goal of input.goals) {
    if (goal.status !== 'active') continue;
    const progress = calculateGoalProgress(goal, asOf);
    if (!progress.isOverdue) continue;
    alerts.push({
      id: `goal-${goal.id}`,
      severity: 'warning',
      icon: 'flag-outline',
      title: `${goal.name} is past its deadline`,
      detail: `${formatMoney(progress.remainingMinor, goal.currency)} still to go.`,
      href: '/goals',
    });
  }

  if (input.syncStatus === 'error') {
    alerts.push({
      id: 'sync-error',
      severity: 'warning',
      icon: 'cloud-offline-outline',
      title: 'Sync failed',
      detail: 'Your data is safe on this phone. It will retry on the next sync.',
      href: '/settings',
    });
  } else if (input.syncStatus === 'blocked') {
    alerts.push({
      id: 'sync-blocked',
      severity: 'warning',
      icon: 'lock-closed-outline',
      title: 'Sync blocked',
      detail: input.syncErrorMessage ?? 'Open Settings to resume backups.',
      href: '/settings',
    });
  }

  if (input.attachmentUploadError) {
    alerts.push({
      id: 'attachment-upload',
      severity: 'warning',
      icon: 'cloud-upload-outline',
      title: 'Attachments not backed up',
      detail: input.attachmentUploadError,
      href: '/settings',
    });
  }

  // Array.prototype.sort is stable, so source order holds within a severity.
  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
