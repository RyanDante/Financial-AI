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

/** ISO bounds for a repository query: `from` inclusive, `to` exclusive (start of the next month). */
export function monthRange(month: MonthKey): { from: string; to: string } {
  const [year, monthIndex] = parseMonth(month);
  return { from: new Date(year, monthIndex, 1).toISOString(), to: new Date(year, monthIndex + 1, 1).toISOString() };
}

/** "September 2026" (or the device locale's equivalent). */
export function formatMonthLabel(month: MonthKey): string {
  const [year, monthIndex] = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Short month name for chart labels ("Sep"). */
export function formatMonthShort(month: MonthKey): string {
  const [year, monthIndex] = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'short' });
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
