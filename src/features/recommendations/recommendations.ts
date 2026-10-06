import type { Ionicons } from '@expo/vector-icons';
import { calculateBudgetRemaining, calculateMonthlySpending } from '@/finance/calculations';
import { formatMoney } from '@/utils/currency';
import { daysBetween, MS_PER_DAY } from '@/utils/months';
import { formatDue, toBillItems } from '@/features/bills/bills';
import type { CurrencyCode } from '@/constants/currencies';
import type { BudgetCategory, Category, RecurringExpense, Subscription, Transaction } from '@/types/finance';
import { ESSENTIALS, type Essential } from './essentials';

export type RecommendationKind = 'repeat' | 'bill' | 'essential';

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  icon: keyof typeof Ionicons.glyphMap;
  /** Short label above the title: why this card is here. */
  reason: string;
  title: string;
  detail: string;
  /** Values for the "Add as expense" shortcut. */
  prefill: { categoryId: string | null; merchant: string | null };
}

export interface RecommendationInput {
  currency: CurrencyCode;
  month: string;
  categories: Category[];
  transactions: Transaction[];
  budgetCategories: BudgetCategory[];
  subscriptions: Subscription[];
  recurringExpenses: RecurringExpense[];
  asOf?: Date;
}

export const MAX_RECOMMENDATIONS = 8;
const HISTORY_WINDOW_DAYS = 90;
const MIN_PURCHASE_DAYS = 3;
const BILL_HORIZON_DAYS = 7;
const ESSENTIALS_SHOWN = 3;

/**
 * Cards for the Home carousel, in this order: purchases you make regularly
 * that look due (learned from your own transactions), bills due within a
 * week, then a few everyday essentials with your remaining budget for their
 * category. Every number is computed from your data; nothing is priced or
 * guessed.
 */
export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const asOf = input.asOf ?? new Date();
  const cards = [...repeatPurchases(input, asOf), ...billsDueSoon(input, asOf), ...essentials(input, asOf)];
  return cards.slice(0, MAX_RECOMMENDATIONS);
}

function repeatPurchases(input: RecommendationInput, asOf: Date): Recommendation[] {
  const since = asOf.getTime() - HISTORY_WINDOW_DAYS * MS_PER_DAY;
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const groups = new Map<string, Transaction[]>();

  for (const tx of input.transactions) {
    if (tx.type !== 'expense') continue;
    const at = new Date(tx.occurredAt).getTime();
    if (at < since || at > asOf.getTime()) continue;
    const merchant = tx.merchant?.trim().toLowerCase();
    const key = merchant ? `m:${merchant}` : tx.categoryId ? `c:${tx.categoryId}` : null;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }

  const due: { card: Recommendation; overdueRatio: number }[] = [];
  for (const [key, txs] of groups) {
    // One purchase per day, so several items bought on one trip count once.
    const byDay = new Map<string, Transaction>();
    for (const tx of txs) byDay.set(tx.occurredAt.slice(0, 10), tx);
    const purchases = [...byDay.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    if (purchases.length < MIN_PURCHASE_DAYS) continue;

    const intervals = purchases.slice(1).map((tx, i) => daysBetween(new Date(purchases[i].occurredAt), new Date(tx.occurredAt)));
    const interval = Math.round(median(intervals));
    if (interval < 1) continue;

    const last = purchases[purchases.length - 1];
    const daysSince = daysBetween(new Date(last.occurredAt), asOf);
    // Due, but not so long ago that the habit has clearly stopped.
    if (daysSince < interval || daysSince > interval * 3) continue;

    const typicalMinor = Math.round(median(txs.map((tx) => tx.amountMinor)));
    const category = last.categoryId ? categoryById.get(last.categoryId) : undefined;
    const name = last.merchant?.trim() || category?.name || 'Regular purchase';
    due.push({
      overdueRatio: daysSince / interval,
      card: {
        id: `repeat-${key}`,
        kind: 'repeat',
        icon: 'repeat-outline',
        reason: 'You buy this regularly',
        title: name,
        detail: `Usually every ${plural(interval, 'day')} · last ${plural(daysSince, 'day')} ago · typically ${formatMoney(typicalMinor, last.currency)}`,
        prefill: { categoryId: last.categoryId, merchant: last.merchant?.trim() || null },
      },
    });
  }

  return due.sort((a, b) => b.overdueRatio - a.overdueRatio).map((d) => d.card);
}

function billsDueSoon(input: RecommendationInput, asOf: Date): Recommendation[] {
  return toBillItems(input.subscriptions, input.recurringExpenses, asOf)
    .filter((bill) => bill.inDays !== null && bill.inDays <= BILL_HORIZON_DAYS)
    .map((bill) => ({
      id: `bill-${bill.id}`,
      kind: 'bill' as const,
      icon: 'calendar-outline' as const,
      reason: 'Bill coming up',
      title: bill.name,
      detail: `${formatMoney(bill.amountMinor, bill.currency)} ${formatDue(bill).toLowerCase()}`,
      prefill: { categoryId: bill.categoryId, merchant: bill.name },
    }));
}

function essentials(input: RecommendationInput, asOf: Date): Recommendation[] {
  const start = dayOfYear(asOf) % ESSENTIALS.length;
  const picked: Essential[] = [];
  for (let i = 0; i < Math.min(ESSENTIALS_SHOWN, ESSENTIALS.length); i++) picked.push(ESSENTIALS[(start + i) % ESSENTIALS.length]);

  return picked.map((item) => {
    const category = input.categories.find((c) => c.name.toLowerCase() === item.categoryName.toLowerCase());
    return {
      id: `essential-${item.id}`,
      kind: 'essential' as const,
      icon: item.icon,
      reason: 'Everyday essential',
      title: item.name,
      detail: budgetLine(input, category, item.categoryName),
      prefill: { categoryId: category?.id ?? null, merchant: item.name },
    };
  });
}

function budgetLine(input: RecommendationInput, category: Category | undefined, categoryName: string): string {
  const limit = category ? input.budgetCategories.find((bc) => bc.categoryId === category.id) : undefined;
  if (!category || !limit) return `No ${categoryName} budget set this month`;
  const spentMinor = calculateMonthlySpending(
    input.transactions.filter((tx) => tx.categoryId === category.id),
    input.month,
  );
  const { remainingMinor, isOverBudget } = calculateBudgetRemaining(limit.limitMinor, spentMinor);
  return isOverBudget
    ? `${category.name} budget is ${formatMoney(Math.abs(remainingMinor), input.currency)} over this month`
    : `${formatMoney(remainingMinor, input.currency)} left in your ${category.name} budget this month`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function dayOfYear(date: Date): number {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / MS_PER_DAY);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
