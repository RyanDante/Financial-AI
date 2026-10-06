import { toMonthlyEquivalent } from '@/finance/calculations';
import { calendarDaysUntil } from '@/utils/months';
import type { CurrencyCode } from '@/constants/currencies';
import type { RecurrenceFrequency, RecurringExpense, Subscription } from '@/types/finance';

export type BillSource = 'subscription' | 'recurring';

export interface BillItem {
  /** Unique across both sources. */
  id: string;
  source: BillSource;
  sourceId: string;
  name: string;
  categoryId: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  monthlyEquivalentMinor: number;
  /** The next date on or after today, rolled forward from the stored date; null if none is known or a one-time bill has passed. */
  nextDue: Date | null;
  /** Calendar days until `nextDue` (0 = today). */
  inDays: number | null;
}

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One time',
};

/**
 * Subscriptions and recurring bills as one list, soonest first (bills with
 * no known date last). The stored due date isn't advanced in the database
 * when it passes, so it's rolled forward here by the bill's frequency; this
 * is display logic only and writes nothing.
 */
export function toBillItems(subscriptions: Subscription[], recurringExpenses: RecurringExpense[], asOf = new Date()): BillItem[] {
  const items: BillItem[] = [
    ...subscriptions
      .filter((s) => s.isActive)
      .map((s) => build('subscription', s.id, s.name, s.categoryId, s.amountMinor, s.currency, s.billingCycle === 'yearly' ? 'yearly' : 'monthly', s.nextBillingAt, asOf)),
    ...recurringExpenses
      .filter((r) => r.isActive)
      .map((r) => build('recurring', r.id, r.name, r.categoryId, r.amountMinor, r.currency, r.frequency, r.nextDueAt, asOf)),
  ];
  return items.sort((a, b) => (a.nextDue?.getTime() ?? Infinity) - (b.nextDue?.getTime() ?? Infinity));
}

/** The first occurrence on or after `asOf`'s day. */
export function nextOccurrence(stored: Date, frequency: RecurrenceFrequency, asOf = new Date()): Date | null {
  if (calendarDaysUntil(stored, asOf) >= 0) return stored;
  if (frequency === 'one_time') return null;
  const next = new Date(stored);
  for (let guard = 0; calendarDaysUntil(next, asOf) < 0 && guard < 1000; guard++) {
    if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

/** "today", "tomorrow", "in 5 days", or a date for anything further out. */
export function formatDue(item: Pick<BillItem, 'nextDue' | 'inDays'>): string {
  if (!item.nextDue || item.inDays === null) return 'No due date set';
  if (item.inDays === 0) return 'Due today';
  if (item.inDays === 1) return 'Due tomorrow';
  if (item.inDays <= 7) return `Due in ${item.inDays} days`;
  return `Due ${item.nextDue.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

function build(
  source: BillSource,
  sourceId: string,
  name: string,
  categoryId: string | null,
  amountMinor: number,
  currency: CurrencyCode,
  frequency: RecurrenceFrequency,
  storedDue: string | null,
  asOf: Date,
): BillItem {
  const nextDue = storedDue ? nextOccurrence(new Date(storedDue), frequency, asOf) : null;
  return {
    id: `${source}-${sourceId}`,
    source,
    sourceId,
    name,
    categoryId,
    amountMinor,
    currency,
    frequency,
    monthlyEquivalentMinor: toMonthlyEquivalent(amountMinor, frequency),
    nextDue,
    inDays: nextDue ? calendarDaysUntil(nextDue, asOf) : null,
  };
}
