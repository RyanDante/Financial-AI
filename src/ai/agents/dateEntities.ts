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
