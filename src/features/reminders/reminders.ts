import { nextDebtDueDate } from '@/features/allowance/allowance';
import type { BillItem } from '@/features/bills/bills';
import { formatMoney } from '@/utils/currency';
import type { Debt } from '@/types/finance';

export interface PlannedReminder {
  id: string;
  title: string;
  body: string;
  date: Date;
}

export const REMINDER_HOUR = 9;
export const REMINDER_HORIZON_DAYS = 30;
export const BUDGET_WARNING_PERCENT = 85;

/** 09:00 on the day before `due`. */
export function dayBeforeAt9(due: Date): Date {
  return new Date(due.getFullYear(), due.getMonth(), due.getDate() - 1, REMINDER_HOUR, 0, 0);
}

/**
 * Phone notifications for the next 30 days: the morning before each bill
 * and each debt payment you owe. Reminders whose time has already passed
 * are skipped (the Alerts screen still shows anything due soon). Rebuilt
 * from scratch whenever data changes, so edits and deletes never leave a
 * stale reminder behind.
 */
export function planReminders(bills: BillItem[], debts: Debt[], asOf = new Date()): PlannedReminder[] {
  const horizon = new Date(asOf.getTime() + REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const planned: PlannedReminder[] = [];

  for (const bill of bills) {
    if (!bill.nextDue) continue;
    planned.push({
      id: `bill-${bill.id}`,
      title: `${bill.name} is due tomorrow`,
      body: `${formatMoney(bill.amountMinor, bill.currency)}. Make sure it's set aside.`,
      date: dayBeforeAt9(bill.nextDue),
    });
  }

  for (const debt of debts) {
    if (debt.direction !== 'i_owe' || debt.remainingMinor <= 0) continue;
    const due = nextDebtDueDate(debt, asOf);
    if (!due) continue;
    const amount = debt.minimumPaymentMinor > 0 ? Math.min(debt.minimumPaymentMinor, debt.remainingMinor) : debt.remainingMinor;
    planned.push({
      id: `debt-${debt.id}`,
      title: `Payment to ${debt.counterparty ?? debt.name} is due tomorrow`,
      body: `${formatMoney(amount, debt.currency)} to pay.`,
      date: dayBeforeAt9(due),
    });
  }

  return planned.filter((r) => r.date > asOf && r.date <= horizon).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface BudgetUsage {
  categoryId: string;
  categoryName: string;
  limitMinor: number;
  spentMinor: number;
  currency: BillItem['currency'];
}

export interface BudgetWarning {
  key: string;
  title: string;
  body: string;
}

/**
 * Categories that reached 85% of their limit this month and haven't been
 * notified yet this month: one notification per category per month, not
 * one per transaction.
 */
export function budgetWarnings(usage: BudgetUsage[], month: string, alreadySent: Set<string>): BudgetWarning[] {
  return usage
    .filter((u) => u.limitMinor > 0 && (u.spentMinor / u.limitMinor) * 100 >= BUDGET_WARNING_PERCENT)
    .map((u) => ({ u, key: `${month}:${u.categoryId}` }))
    .filter(({ key }) => !alreadySent.has(key))
    .map(({ u, key }) => {
      const over = u.spentMinor > u.limitMinor;
      return {
        key,
        title: over ? `${u.categoryName} is over budget` : `${u.categoryName} budget is ${Math.floor((u.spentMinor / u.limitMinor) * 100)}% used`,
        body: over
          ? `${formatMoney(u.spentMinor - u.limitMinor, u.currency)} over this month.`
          : `${formatMoney(u.limitMinor - u.spentMinor, u.currency)} left for the rest of the month.`,
      };
    });
}
