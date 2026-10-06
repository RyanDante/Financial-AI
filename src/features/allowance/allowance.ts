import { nextOccurrence } from '@/features/bills/bills';
import { calendarDaysUntil } from '@/utils/months';
import type { Debt, IncomeSource } from '@/types/finance';

export interface Payday {
  source: string;
  date: Date;
  /** Calendar days from today (0 = today). */
  inDays: number;
}

/** The soonest upcoming payday across active income sources, rolled forward past dates like bills are. */
export function nextPayday(sources: IncomeSource[], asOf = new Date()): Payday | null {
  let best: Payday | null = null;
  for (const source of sources) {
    if (!source.isActive || !source.nextExpectedAt) continue;
    const date = nextOccurrence(new Date(source.nextExpectedAt), source.frequency, asOf);
    if (!date) continue;
    const inDays = calendarDaysUntil(date, asOf);
    if (!best || inDays < best.inDays) best = { source: source.source, date, inDays };
  }
  return best;
}

export interface DailyAllowance {
  perDayMinor: number;
  days: number;
  payday: Payday;
}

/**
 * How much can go out per day until the next payday: "Available to spend
 * safely" (which already sets aside this month's bills and the savings
 * reserve) spread over the days left, today included. Never negative: a
 * negative safe-to-spend gives 0 a day, and the alert explains why. Whole
 * minor units, rounded down so the total never exceeds what's available.
 */
export function dailyAllowance(availableMinor: number, sources: IncomeSource[], asOf = new Date()): DailyAllowance | null {
  const payday = nextPayday(sources, asOf);
  if (!payday) return null;
  const days = Math.max(payday.inDays, 1);
  return { perDayMinor: Math.max(0, Math.floor(availableMinor / days)), days, payday };
}

/** The next date a debt's monthly due day falls on, today or later (clamped to short months: the 31st becomes the 30th, or the 28th/29th). */
export function nextDebtDueDate(debt: Pick<Debt, 'dueDayOfMonth'>, asOf = new Date()): Date | null {
  if (!debt.dueDayOfMonth) return null;
  for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
    const year = asOf.getFullYear();
    const month = asOf.getMonth() + monthOffset;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const candidate = new Date(year, month, Math.min(debt.dueDayOfMonth, lastDay), 9);
    if (calendarDaysUntil(candidate, asOf) >= 0) return candidate;
  }
  return null;
}
