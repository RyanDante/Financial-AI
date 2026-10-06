const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function previousMonthKey(now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  return currentMonthKey(d);
}

/**
 * Looks for an explicit month name in the text ("spending in March") and
 * returns its "YYYY-MM" key, assuming the current year — there's no
 * "March 2024" vs "March 2026" disambiguation in this phase. Returns null
 * if no month name is mentioned, so the caller can fall back to the
 * current month.
 */
export function extractNamedMonthKey(text: string, now = new Date()): string | null {
  const lower = text.toLowerCase();
  const index = MONTH_NAMES.findIndex((name) => new RegExp(`\\b${name}\\b`).test(lower));
  if (index === -1) return null;
  return `${now.getFullYear()}-${String(index + 1).padStart(2, '0')}`;
}

export function mentionsComparison(text: string): boolean {
  return /\bcompar|\bchanged\b|vs\.?\s*last month|previous month|last month/i.test(text);
}

/**
 * Months from `now` until the next occurrence of a named month ("How much
 * will I have by March?") — 0 if the named month is the current month,
 * otherwise 1-11 counting forward, wrapping to next year. Returns null if
 * no month is named, so the caller can fall back to a default horizon.
 */
export function monthsUntilNamedMonth(text: string, now = new Date()): number | null {
  const lower = text.toLowerCase();
  const targetIndex = MONTH_NAMES.findIndex((name) => new RegExp(`\\b${name}\\b`).test(lower));
  if (targetIndex === -1) return null;
  return (targetIndex - now.getMonth() + 12) % 12;
}

/** The ISO-timestamp range covering the 7 days up to and including `now`, for "transactions from last week" queries. */
export function lastWeekRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  return { from: from.toISOString(), to: now.toISOString() };
}
