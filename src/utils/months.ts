import { getLocale } from '@/i18n/language';
/**
 * Month keys are `YYYY-MM` in local time, the same format the finance engine
 * compares against `occurredAt.slice(0, 7)` (src/finance/calculations/spending.ts).
 */
export type MonthKey = string;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function monthKeyOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(asOf = new Date()): MonthKey {
  return monthKeyOf(asOf);
}

/** `shiftMonth('2026-01', -1)` → `'2025-12'`. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, monthIndex] = parseMonth(month);
  return monthKeyOf(new Date(year, monthIndex + delta, 1));
}

/**
 * ISO bounds for a repository query covering `month`, in UTC, because the
 * finance engine buckets transactions by `occurredAt.slice(0, 7)` (the UTC
 * month). The repository's `to` is inclusive, so callers should still keep
 * only rows where `isInMonth(tx.occurredAt, month)`.
 */
export function monthRange(month: MonthKey): { from: string; to: string } {
  return { from: `${month}-01T00:00:00.000Z`, to: `${shiftMonth(month, 1)}-01T00:00:00.000Z` };
}

/** Same rule as calculateMonthlySpending: the UTC month of the ISO timestamp. */
export function isInMonth(isoDate: string, month: MonthKey): boolean {
  return isoDate.slice(0, 7) === month;
}

/** "September 2026" ("septembre 2026" in French). */
export function formatMonthLabel(month: MonthKey): string {
  const [year, monthIndex] = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
}

/** Short month name for chart labels ("Sep"). */
export function formatMonthShort(month: MonthKey): string {
  const [year, monthIndex] = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString(getLocale(), { month: 'short' });
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Calendar days from `asOf` until `date` (0 = today, 1 = tomorrow, negative = past), ignoring the time of day. */
export function calendarDaysUntil(date: Date, asOf = new Date()): number {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(date) - startOf(asOf)) / MS_PER_DAY);
}

function parseMonth(month: MonthKey): [number, number] {
  const [year, monthNumber] = month.split('-').map(Number);
  return [year, monthNumber - 1];
}
