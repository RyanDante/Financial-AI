import type { Ionicons } from '@expo/vector-icons';
import { calculateAvailableMoney, calculateBudgetRemaining, calculateGoalProgress, calculateMonthlySpending } from '@/finance/calculations';
import { formatMoney } from '@/utils/currency';
import type { CurrencyCode } from '@/constants/currencies';
import type { SyncStatus } from '@/services/sync/sync.types';
import type { BudgetCategory, Category, Debt, Goal, Transaction } from '@/types/finance';
import { nextDebtDueDate } from '@/features/allowance/allowance';
import { calendarDaysUntil } from '@/utils/months';
import { formatDue, type BillItem } from '@/features/bills/bills';
import { categoryLabel, t, tn } from '@/i18n';

export type AlertSeverity = 'danger' | 'warning';

/** Where tapping an alert takes the user. Only routes that already exist. */
export type AlertHref = '/' | '/budgets' | '/goals' | '/settings' | '/bills' | '/debts';

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
  /** From toBillItems; defaults to none. */
  bills?: BillItem[];
  /** Open debts; ones with a monthly due day within BILL_ALERT_DAYS raise an alert. */
  debts?: Debt[];
  asOf?: Date;
}

/** Bills due this many calendar days ahead (or sooner) raise an alert. */
export const BILL_ALERT_DAYS = 3;

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
      title: t('alert.negativeTitle'),
      detail: t('alert.negativeDetail', { amount: formatMoney(Math.abs(availableMinor), input.currency) }),
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
      title: t('alert.overBudgetTitle', { category: categoryLabel(categoryById.get(limit.categoryId)?.name ?? t('alert.aCategory')) }),
      detail: t('alert.overBudgetDetail', { amount: formatMoney(Math.abs(remainingMinor), input.currency) }),
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
      title: t('alert.goalLateTitle', { goal: goal.name }),
      detail: t('alert.goalLateDetail', { amount: formatMoney(progress.remainingMinor, goal.currency) }),
      href: '/goals',
    });
  }

  for (const bill of input.bills ?? []) {
    if (bill.inDays === null || bill.inDays > BILL_ALERT_DAYS) continue;
    alerts.push({
      id: `bill-${bill.id}`,
      severity: 'warning',
      icon: 'calendar-outline',
      title: t('alert.billTitle', { bill: bill.name, due: formatDue(bill).toLowerCase() }),
      detail: t('alert.toPay', { amount: formatMoney(bill.amountMinor, bill.currency) }),
      href: '/bills',
    });
  }

  for (const debt of input.debts ?? []) {
    if (debt.remainingMinor <= 0) continue;
    const due = nextDebtDueDate(debt, asOf);
    if (!due) continue;
    const inDays = calendarDaysUntil(due, asOf);
    if (inDays > BILL_ALERT_DAYS) continue;
    const when = inDays === 0 ? t('alert.when.today') : inDays === 1 ? t('alert.when.tomorrow') : tn('alert.when.inDays', inDays);
    const who = debt.counterparty ?? debt.name;
    const amount = formatMoney(debt.minimumPaymentMinor > 0 ? Math.min(debt.minimumPaymentMinor, debt.remainingMinor) : debt.remainingMinor, debt.currency);
    alerts.push(
      debt.direction === 'i_owe'
        ? { id: `debt-${debt.id}`, severity: 'warning', icon: 'cash-outline', title: t('alert.debtPayTitle', { who, when }), detail: t('alert.toPay', { amount }), href: '/debts' }
        : { id: `debt-${debt.id}`, severity: 'warning', icon: 'cash-outline', title: t('alert.debtOwedTitle', { who, when }), detail: t('alert.expected', { amount }), href: '/debts' },
    );
  }

  if (input.syncStatus === 'error') {
    alerts.push({
      id: 'sync-error',
      severity: 'warning',
      icon: 'cloud-offline-outline',
      title: t('alert.syncFailedTitle'),
      detail: t('alert.syncFailedDetail'),
      href: '/settings',
    });
  } else if (input.syncStatus === 'blocked') {
    alerts.push({
      id: 'sync-blocked',
      severity: 'warning',
      icon: 'lock-closed-outline',
      title: t('alert.syncBlockedTitle'),
      detail: input.syncErrorMessage ?? t('alert.syncBlockedDetail'),
      href: '/settings',
    });
  }

  if (input.attachmentUploadError) {
    alerts.push({
      id: 'attachment-upload',
      severity: 'warning',
      icon: 'cloud-upload-outline',
      title: t('alert.attachmentsTitle'),
      detail: input.attachmentUploadError,
      href: '/settings',
    });
  }

  // Array.prototype.sort is stable, so source order holds within a severity.
  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
