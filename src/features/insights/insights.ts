import { calculateMonthlySpending, type CategorySpending } from '@/finance/calculations';
import type { Transaction } from '@/types/finance';
import { categoryLabel, t } from '@/i18n';

export interface BreakdownRow {
  key: string;
  label: string;
  totalMinor: number;
  /** Share of the month's spending, 0–100. */
  percentage: number;
  /** Bar length relative to the largest row, 0–1, so the top category fills the track. */
  barRatio: number;
}

/**
 * The top `limit` categories from calculateSpendingByCategory, with the rest
 * folded into one "Other" row so the list never grows past `limit + 1` bars
 * (ui.md §19: beyond a few slices, use a ranked list).
 */
export function toBreakdownRows(spending: CategorySpending[], limit = 5): BreakdownRow[] {
  const ranked = spending.filter((s) => s.totalMinor > 0);
  const top = ranked.slice(0, limit);
  const rest = ranked.slice(limit);
  const rows: Omit<BreakdownRow, 'barRatio'>[] = top.map((s) => ({
    key: s.categoryId ?? 'uncategorized',
    label: categoryLabel(s.categoryName),
    totalMinor: s.totalMinor,
    percentage: s.percentage,
  }));
  if (rest.length > 0) {
    rows.push({
      key: 'other',
      label: t('insights.other', { count: rest.length }),
      totalMinor: rest.reduce((sum, s) => sum + s.totalMinor, 0),
      percentage: rest.reduce((sum, s) => sum + s.percentage, 0),
    });
  }
  const max = Math.max(0, ...rows.map((r) => r.totalMinor));
  return rows.map((r) => ({ ...r, barRatio: max === 0 ? 0 : r.totalMinor / max }));
}

export interface TrendPoint {
  month: string;
  totalMinor: number;
  /** Column height relative to the highest month, 0–1. */
  heightRatio: number;
}

/** Spending per month for `months` (oldest first), via the engine's calculateMonthlySpending. */
export function toTrendPoints(transactions: Transaction[], months: string[]): TrendPoint[] {
  const totals = months.map((month) => ({ month, totalMinor: calculateMonthlySpending(transactions, month) }));
  const max = Math.max(0, ...totals.map((t) => t.totalMinor));
  return totals.map((t) => ({ ...t, heightRatio: max === 0 ? 0 : t.totalMinor / max }));
}
