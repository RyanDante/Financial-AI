import { buildRecommendations, MAX_RECOMMENDATIONS, type RecommendationInput } from './recommendations';
import type { BudgetCategory, Category, RecurringExpense, Subscription, Transaction } from '@/types/finance';

const STAMP = '2026-01-01T00:00:00.000Z';
const ASOF = new Date(2026, 8, 20, 12); // 20 Sep 2026, local noon

function cat(id: string, name: string): Category {
  return { id, name, icon: null, color: null, type: 'expense', isDefault: true, parentId: null, createdAt: STAMP, updatedAt: STAMP };
}
const food = cat('food', 'Food');
const shopping = cat('shopping', 'Shopping');
const bills = cat('bills', 'Bills');

function daysAgo(n: number): string {
  return new Date(2026, 8, 20 - n, 10).toISOString();
}

function expense(id: string, daysBack: number, amountMinor: number, merchant: string | null, categoryId: string | null = food.id): Transaction {
  return { id, accountId: 'a', categoryId, transferAccountId: null, amountMinor, currency: 'XAF', type: 'expense', merchant, description: null, notes: null, occurredAt: daysAgo(daysBack), source: 'manual', createdAt: STAMP, updatedAt: STAMP };
}

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return { currency: 'XAF', month: '2026-09', categories: [food, shopping, bills], transactions: [], budgetCategories: [], subscriptions: [], recurringExpenses: [], asOf: ASOF, ...overrides };
}

describe('buildRecommendations', () => {
  it('shows only essentials, without prices, when there is no history', () => {
    const cards = buildRecommendations(input());
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => c.kind === 'essential')).toBe(true);
    expect(cards.every((c) => !/FCFA/.test(c.detail))).toBe(true);
    expect(cards[0].detail).toMatch(/^No (Food|Shopping|Bills) budget set this month$/);
  });

  it('flags a weekly purchase that is now due, with its typical amount', () => {
    const tx = [expense('1', 30, 18_000, 'Marché Mokolo'), expense('2', 23, 19_000, 'Marché Mokolo'), expense('3', 16, 18_500, 'Marché Mokolo'), expense('4', 9, 18_500, 'marché mokolo ')];
    const [first] = buildRecommendations(input({ transactions: tx }));
    expect(first).toMatchObject({ kind: 'repeat', title: 'marché mokolo', prefill: { categoryId: 'food', merchant: 'marché mokolo' } });
    expect(first.detail).toBe('Usually every 7 days · last 9 days ago · typically 18,500 FCFA');
  });

  it('does not flag a habit that is not due yet, or that stopped long ago', () => {
    const notDue = [expense('1', 17, 5_000, 'Bakery'), expense('2', 10, 5_000, 'Bakery'), expense('3', 3, 5_000, 'Bakery')];
    const stopped = [expense('4', 80, 5_000, 'Gym'), expense('5', 73, 5_000, 'Gym'), expense('6', 66, 5_000, 'Gym')];
    const cards = buildRecommendations(input({ transactions: [...notDue, ...stopped] }));
    expect(cards.some((c) => c.kind === 'repeat')).toBe(false);
  });

  it('needs purchases on at least 3 different days', () => {
    const sameDay = [expense('1', 14, 2_000, 'Kiosk'), expense('2', 14, 2_000, 'Kiosk'), expense('3', 7, 2_000, 'Kiosk')];
    expect(buildRecommendations(input({ transactions: sameDay })).some((c) => c.kind === 'repeat')).toBe(false);
  });

  it('lists bills due within a week, soonest first', () => {
    const sub: Subscription = { id: 's', name: 'Canal+', categoryId: bills.id, amountMinor: 15_000, currency: 'XAF', billingCycle: 'monthly', nextBillingAt: new Date(2026, 8, 21, 8).toISOString(), isActive: true };
    const rent: RecurringExpense = { id: 'r', name: 'Rent', categoryId: bills.id, amountMinor: 120_000, currency: 'XAF', frequency: 'monthly', nextDueAt: new Date(2026, 8, 25).toISOString(), isActive: true };
    const later: RecurringExpense = { ...rent, id: 'r2', name: 'Insurance', nextDueAt: new Date(2026, 9, 15).toISOString() };
    const cards = buildRecommendations(input({ subscriptions: [sub], recurringExpenses: [rent, later] })).filter((c) => c.kind === 'bill');
    expect(cards.map((c) => c.title)).toEqual(['Canal+', 'Rent']);
    expect(cards[0].detail).toBe('15,000 FCFA due tomorrow');
    expect(cards[1].detail).toBe('120,000 FCFA due in 5 days');
  });

  it('shows the remaining category budget on essentials', () => {
    const limits: BudgetCategory[] = [food, shopping, bills].map((c) => ({ id: `bc-${c.id}`, budgetId: 'b', categoryId: c.id, limitMinor: 50_000, createdAt: STAMP, updatedAt: STAMP }));
    const cards = buildRecommendations(input({ budgetCategories: limits, transactions: [expense('1', 2, 20_000, null, food.id)] }));
    const foodCard = cards.find((c) => c.prefill.categoryId === food.id);
    if (foodCard) expect(foodCard.detail).toBe('30,000 FCFA left in your Food budget this month');
    expect(cards.every((c) => /left in your|over this month/.test(c.detail))).toBe(true);
  });

  it('never returns more than the cap', () => {
    const subs: Subscription[] = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, name: `Sub ${i}`, categoryId: null, amountMinor: 1_000, currency: 'XAF', billingCycle: 'monthly', nextBillingAt: new Date(2026, 8, 22).toISOString(), isActive: true }));
    expect(buildRecommendations(input({ subscriptions: subs }))).toHaveLength(MAX_RECOMMENDATIONS);
  });
});
